import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { PlatformRole, SOCKET_EVENTS } from "@kldsim/shared";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { createRedisClient } from "../redis.js";
import { prisma } from "../db.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import { sessionRoom, teamRoom, userRoom } from "./rooms.js";

/**
 * socket.io types `Socket.data` as the library's generic default (`any`)
 * unless the Server/Socket classes are parameterized end-to-end, which would
 * ripple through every file that touches a socket. Instead we annotate
 * `socket.data.auth` with this type at each read/write site — `any` accepts
 * an explicitly-typed const without complaint, so this is exactly as safe
 * as a real generic parameterization without the ripple.
 */
export interface SocketAuthData {
  userId: string;
  tenantId: string;
  role: PlatformRole;
  email: string;
}

let io: SocketIOServer | null = null;

/** Non-request code (BullMQ workers, background evaluators) reach the live socket server through this singleton. */
export function getIO(): SocketIOServer | null {
  return io;
}

export async function initSocketServer(httpServer: HttpServer): Promise<SocketIOServer> {
  const pubClient = createRedisClient("socketio-pub");
  const subClient = createRedisClient("socketio-sub");

  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("Missing auth token");
      const payload = verifyAccessToken(token);
      const auth: SocketAuthData = { userId: payload.sub, tenantId: payload.tenantId, role: payload.role, email: payload.email };
      socket.data.auth = auth;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const auth: SocketAuthData = socket.data.auth;
    socket.join(userRoom(auth.tenantId, auth.userId));
    logger.debug({ userId: auth.userId }, "Socket connected");

    socket.on(SOCKET_EVENTS.JOIN_SESSION, async ({ sessionId }: { sessionId: string }) => {
      const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId: auth.tenantId } });
      if (!session) return;
      socket.join(sessionRoom(sessionId));
    });

    socket.on(SOCKET_EVENTS.JOIN_TEAM, async ({ sessionId, teamId }: { sessionId: string; teamId: string }) => {
      const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId: auth.tenantId } });
      if (!session) return;

      const isFacilitatorOrAdmin = auth.role === PlatformRole.FACILITATOR || auth.role === PlatformRole.PLATFORM_ADMIN;
      if (!isFacilitatorOrAdmin) {
        const membership = await prisma.teamMember.findFirst({ where: { teamId, userId: auth.userId, team: { sessionId } } });
        if (!membership) return;
      }
      socket.join(teamRoom(sessionId, teamId));
    });
  });

  logger.info("Socket.IO server initialized with Redis adapter");
  return io;
}

export function emitToSession(sessionId: string, event: string, payload: unknown): void {
  io?.to(sessionRoom(sessionId)).emit(event, payload);
}

export function emitToTeam(sessionId: string, teamId: string, event: string, payload: unknown): void {
  io?.to(teamRoom(sessionId, teamId)).emit(event, payload);
}

export function emitToUser(tenantId: string, userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(tenantId, userId)).emit(event, payload);
}
