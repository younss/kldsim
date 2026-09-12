import { Router } from "express";
import { PlatformRole, sendNegotiationMessageSchema } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { ForbiddenError } from "../../errors.js";
import { prisma } from "../../db.js";
import { proposalEvaluationQueue } from "../../jobs/queue.js";
import * as negotiationsService from "./negotiations.service.js";

export const negotiationsRouter = Router({ mergeParams: true });
negotiationsRouter.use(requireAuth);

async function assertTeamAccess(auth: NonNullable<import("express").Request["auth"]>, teamId: string) {
  if (auth.role !== PlatformRole.PLAYER) return;
  const isMember = await negotiationsService.checkTeamMembership(teamId, auth.userId);
  if (!isMember) throw new ForbiddenError("You are not a member of this team");
}

negotiationsRouter.get(
  "/sessions/:sessionId/teams/:teamId/negotiations/:personaId/messages",
  asyncHandler(async (req, res) => {
    const { sessionId, teamId, personaId } = req.params as { sessionId: string; teamId: string; personaId: string };
    await assertTeamAccess(req.auth!, teamId);
    const messages = await prisma.negotiationMessage.findMany({
      where: { sessionId, teamId, personaId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ messages });
  }),
);

negotiationsRouter.post(
  "/sessions/:sessionId/teams/:teamId/negotiations/:personaId/proposals",
  asyncHandler(async (req, res) => {
    const { sessionId, teamId, personaId } = req.params as { sessionId: string; teamId: string; personaId: string };
    await assertTeamAccess(req.auth!, teamId);
    const { content } = sendNegotiationMessageSchema.pick({ content: true }).parse(req.body);

    const message = await negotiationsService.submitProposal(req.auth!.tenantId, sessionId, teamId, personaId, req.auth!.userId, content);

    const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    const job = await proposalEvaluationQueue.add("evaluate", {
      tenantId: req.auth!.tenantId,
      sessionId,
      teamId,
      personaId,
      roundNumber: session.currentRound,
      proposalMessageId: message.id,
      authorUserId: req.auth!.userId,
    });

    res.status(202).json({ jobId: job.id, message });
  }),
);
