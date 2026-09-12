import { create } from "zustand";
import type { PlatformRole } from "@kldsim/shared";
import { api, apiFetch } from "../lib/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: PlatformRole;
  tenantId: string;
}

interface RegisterInput {
  tenantName: string;
  email: string;
  password: string;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: "idle" | "loading" | "ready";
  setAccessToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  status: "idle",

  setAccessToken: (token) => set({ accessToken: token }),

  login: async (email, password) => {
    // skipAuth: a wrong-password 401 here is not an expired session — it
    // must not trigger apiFetch's generic "401 means log out" side effect.
    const data = await apiFetch<{ user: AuthUser; accessToken: string }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    set({ user: data.user, accessToken: data.accessToken, status: "ready" });
  },

  register: async (input) => {
    const data = await apiFetch<{ user: Omit<AuthUser, "tenantId">; tenant: { id: string; name: string }; accessToken: string }>(
      "/api/auth/register",
      { method: "POST", body: input, skipAuth: true },
    );
    set({ user: { ...data.user, tenantId: data.tenant.id }, accessToken: data.accessToken, status: "ready" });
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // best-effort — clear local state regardless
    }
    set({ user: null, accessToken: null, status: "ready" });
  },

  bootstrap: async () => {
    set({ status: "loading" });
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("No active session");
      const data = await response.json();
      get().setAccessToken(data.accessToken);
      const me = await api.get<AuthUser>("/api/auth/me");
      set({ user: me, status: "ready" });
    } catch {
      set({ user: null, accessToken: null, status: "ready" });
    }
  },
}));
