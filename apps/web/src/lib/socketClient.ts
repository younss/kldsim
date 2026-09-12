import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../state/authStore";

let socket: Socket | null = null;

/** Lazily creates a single shared socket connection, authenticated with whatever access token the auth store currently holds. */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io({
    path: "/socket.io",
    autoConnect: false,
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
  });

  useAuthStore.subscribe((state) => {
    if (!socket) return;
    if (!state.accessToken && socket.connected) {
      socket.disconnect();
    }
  });

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
