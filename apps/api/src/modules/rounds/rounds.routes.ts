import { Router } from "express";
import { PlatformRole, submitDecisionSchema } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { ForbiddenError } from "../../errors.js";
import { checkTeamMembership } from "../negotiations/negotiations.service.js";
import * as roundsService from "./rounds.service.js";

export const roundsRouter = Router();
roundsRouter.use(requireAuth);

async function assertTeamAccess(auth: NonNullable<import("express").Request["auth"]>, teamId: string) {
  if (auth.role !== PlatformRole.PLAYER) return;
  const isMember = await checkTeamMembership(teamId, auth.userId);
  if (!isMember) throw new ForbiddenError("You are not a member of this team");
}

roundsRouter.get(
  "/sessions/:sessionId/teams/:teamId/rounds/:roundNumber/decision",
  asyncHandler(async (req, res) => {
    await assertTeamAccess(req.auth!, req.params.teamId!);
    const decision = await roundsService.getDecision(req.params.sessionId!, req.params.teamId!, Number(req.params.roundNumber!));
    res.json({ decision });
  }),
);

roundsRouter.put(
  "/sessions/:sessionId/teams/:teamId/rounds/:roundNumber/decision",
  asyncHandler(async (req, res) => {
    await assertTeamAccess(req.auth!, req.params.teamId!);
    const input = submitDecisionSchema.parse(req.body);
    const decision = await roundsService.saveDecisionDraft(
      req.auth!.tenantId,
      req.params.sessionId!,
      req.params.teamId!,
      Number(req.params.roundNumber!),
      input,
    );
    res.json({ decision });
  }),
);

roundsRouter.post(
  "/sessions/:sessionId/teams/:teamId/rounds/:roundNumber/decision/submit",
  asyncHandler(async (req, res) => {
    await assertTeamAccess(req.auth!, req.params.teamId!);
    const input = submitDecisionSchema.parse(req.body);
    const decision = await roundsService.submitDecision(
      req.auth!.tenantId,
      req.params.sessionId!,
      req.params.teamId!,
      Number(req.params.roundNumber!),
      req.auth!.userId,
      input,
    );
    res.json({ decision });
  }),
);

roundsRouter.get(
  "/sessions/:sessionId/rounds",
  asyncHandler(async (req, res) => {
    const teamId = typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    if (teamId) await assertTeamAccess(req.auth!, teamId);
    const results = await roundsService.getRoundHistory(req.params.sessionId!, teamId);
    res.json({ results });
  }),
);
