import { Router } from "express";
import { z } from "zod";
import { PlatformRole } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import * as sessionsService from "./sessions.service.js";
import * as teamsService from "../teams/teams.service.js";
import * as roundsService from "../rounds/rounds.service.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

const isStaff = (role: PlatformRole) => role === PlatformRole.FACILITATOR || role === PlatformRole.PLATFORM_ADMIN;

sessionsRouter.get(
  "/",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const sessions = await sessionsService.listSessions(req.auth!.tenantId);
    res.json({ sessions });
  }),
);

sessionsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const sessions = await sessionsService.listSessionsForUser(req.auth!.tenantId, req.auth!.userId);
    res.json({ sessions });
  }),
);

const createSessionSchema = z.object({
  scenarioId: z.string().min(1),
  roundDurationSeconds: z.number().int().min(60).max(7200).default(600),
});

sessionsRouter.post(
  "/",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const input = createSessionSchema.parse(req.body);
    const session = await sessionsService.createSession(req.auth!.tenantId, req.auth!.userId, input.scenarioId, input.roundDurationSeconds);
    res.status(201).json({ session });
  }),
);

sessionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const session = await sessionsService.getSession(req.auth!.tenantId, req.params.id!);
    if (!isStaff(req.auth!.role)) {
      await teamsService.getMyTeam(session.id, req.auth!.userId);
    }
    res.json({ session });
  }),
);

sessionsRouter.post(
  "/:id/start",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const session = await sessionsService.startSession(req.auth!.tenantId, req.params.id!);
    res.json({ session });
  }),
);

sessionsRouter.post(
  "/:id/pause",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const session = await sessionsService.pauseSession(req.auth!.tenantId, req.params.id!, req.auth!.userId);
    res.json({ session });
  }),
);

sessionsRouter.post(
  "/:id/resume",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const session = await sessionsService.resumeSession(req.auth!.tenantId, req.params.id!, req.auth!.userId);
    res.json({ session });
  }),
);

const extendTimerSchema = z.object({ additionalSeconds: z.number().int().min(10).max(3600) });

sessionsRouter.post(
  "/:id/timer/extend",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const { additionalSeconds } = extendTimerSchema.parse(req.body);
    const session = await sessionsService.extendTimer(req.auth!.tenantId, req.params.id!, req.auth!.userId, additionalSeconds);
    res.json({ session });
  }),
);

sessionsRouter.post(
  "/:id/round/force-end",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const result = await sessionsService.forceRoundEnd(req.auth!.tenantId, req.params.id!, req.auth!.userId);
    res.json(result);
  }),
);

const injectEventSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  metricImpact: z.object({
    tco: z.number().optional(),
    technicalDebtIndex: z.number().optional(),
    deliveryVelocity: z.number().optional(),
    stakeholderTrust: z.number().optional(),
  }),
});

sessionsRouter.post(
  "/:id/events/inject",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const input = injectEventSchema.parse(req.body);
    await sessionsService.injectEvent(req.auth!.tenantId, req.params.id!, req.auth!.userId, input);
    res.status(204).send();
  }),
);

const broadcastSchema = z.object({ message: z.string().min(1).max(500) });

sessionsRouter.post(
  "/:id/broadcast",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const { message } = broadcastSchema.parse(req.body);
    await sessionsService.broadcastMessage(req.auth!.tenantId, req.params.id!, req.auth!.userId, message);
    res.status(204).send();
  }),
);

sessionsRouter.get(
  "/:id/war-room",
  requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR),
  asyncHandler(async (req, res) => {
    const snapshot = await sessionsService.getWarRoomSnapshot(req.auth!.tenantId, req.params.id!);
    res.json(snapshot);
  }),
);

sessionsRouter.get(
  "/:id/debrief",
  asyncHandler(async (req, res) => {
    const session = await sessionsService.getSession(req.auth!.tenantId, req.params.id!);
    const results = await roundsService.getRoundHistory(session.id);
    res.json({ session, results });
  }),
);
