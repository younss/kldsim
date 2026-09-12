import { Router } from "express";
import { z } from "zod";
import { PlatformRole } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { ForbiddenError } from "../../errors.js";
import * as teamsService from "./teams.service.js";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

const isStaff = (role: PlatformRole) => role === PlatformRole.FACILITATOR || role === PlatformRole.PLATFORM_ADMIN;

teamsRouter.get(
  "/sessions/:sessionId/teams",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const teams = await teamsService.listTeams(req.params.sessionId!);
    res.json({ teams });
  }),
);

teamsRouter.get(
  "/sessions/:sessionId/teams/me",
  asyncHandler(async (req, res) => {
    const team = await teamsService.getMyTeam(req.params.sessionId!, req.auth!.userId);
    res.json({ team });
  }),
);

teamsRouter.get(
  "/sessions/:sessionId/teams/:teamId",
  asyncHandler(async (req, res) => {
    if (!isStaff(req.auth!.role)) {
      const team = await teamsService.getMyTeam(req.params.sessionId!, req.auth!.userId);
      if (team.id !== req.params.teamId!) throw new ForbiddenError("You are not a member of this team");
      res.json({ team });
      return;
    }
    const team = await teamsService.getTeam(req.params.sessionId!, req.params.teamId!);
    res.json({ team });
  }),
);

const createTeamSchema = z.object({
  name: z.string().min(1).max(80),
  memberUserIds: z.array(z.string()).max(20).default([]),
});

teamsRouter.post(
  "/sessions/:sessionId/teams",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const input = createTeamSchema.parse(req.body);
    const team = await teamsService.createTeam(req.auth!.tenantId, req.params.sessionId!, input.name, input.memberUserIds);
    res.status(201).json({ team });
  }),
);

teamsRouter.delete(
  "/sessions/:sessionId/teams/:teamId",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    await teamsService.removeTeam(req.auth!.tenantId, req.params.sessionId!, req.params.teamId!);
    res.status(204).send();
  }),
);
