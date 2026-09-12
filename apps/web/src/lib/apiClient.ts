import { useAuthStore } from "../state/authStore";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
  /** Internal: set on the retry attempt after a silent refresh, to prevent infinite refresh loops. */
  _retried?: boolean;
}

async function parseErrorBody(response: Response): Promise<{ code: string; message: string; issues?: Array<{ path: string; message: string }> }> {
  try {
    const data = await response.json();
    return {
      code: data?.error?.code ?? "UNKNOWN_ERROR",
      message: data?.error?.message ?? response.statusText,
      issues: data?.error?.issues,
    };
  } catch {
    return { code: "UNKNOWN_ERROR", message: response.statusText };
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (!response.ok) return null;
        const data = await response.json();
        useAuthStore.getState().setAccessToken(data.accessToken);
        return data.accessToken as string;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, _retried, headers, ...rest } = options;
  const accessToken = useAuthStore.getState().accessToken;

  const response = await fetch(path, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(accessToken && !skipAuth ? { authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuth && !_retried) {
    const errorBody = await parseErrorBody(response.clone());
    if (errorBody.code === "TOKEN_EXPIRED") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiFetch<T>(path, { ...options, _retried: true });
      }
    }
    useAuthStore.getState().logout();
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new ApiError(response.status, errorBody.code, errorBody.message, errorBody.issues);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T,>(path: string) => apiFetch<T>(path),
  post: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  put: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  patch: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T,>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
