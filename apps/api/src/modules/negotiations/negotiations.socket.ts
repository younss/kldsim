import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { PlatformRole, SOCKET_EVENTS } from "@kldsim/shared";
import { getTenantGateway } from "../providers/providers.service.js";
import { streamChatReply, checkTeamMembership } from "./negotiations.service.js";
import { logger } from "../../logger.js";
import type { SocketAuthData } from "../../realtime/socket.js";

const sendNegotiationMessageEventSchema = z.object({
  sessionId: z.string().min(1),
  teamId: z.string().min(1),
  personaId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

type SendNegotiationMessageEvent = z.infer<typeof sendNegotiationMessageEventSchema>;

/**
 * Registered as an additional "connection" listener on the same io instance
 * created in realtime/socket.ts — kept in its own module so the negotiations
 * feature doesn't force a circular import between socket.ts and
 * negotiations.service.ts (which itself emits back through socket.ts).
 */
export function registerNegotiationSocketHandlers(io: SocketIOServer): void {
  io.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.SEND_NEGOTIATION_MESSAGE, async (raw: SendNegotiationMessageEvent) => {
      const auth: SocketAuthData = socket.data.auth;
      try {
        const { sessionId, teamId, personaId, content } = sendNegotiationMessageEventSchema.parse(raw);

        if (auth.role === PlatformRole.PLAYER) {
          const isMember = await checkTeamMembership(teamId, auth.userId);
          if (!isMember) return;
        }

        const gateway = await getTenantGateway(auth.tenantId);
        await streamChatReply(gateway, auth.tenantId, sessionId, teamId, personaId, auth.userId, content);
      } catch (err) {
        logger.error({ err }, "Negotiation chat handler failed");
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to process negotiation message" });
      }
    });
  });
}
