import { Router } from "express";
import { z } from "zod";
import { PlatformRole, scenarioAuthoringRequestSchema } from "@kldsim/shared";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { scenarioGenerationQueue } from "../../jobs/queue.js";
import * as scenariosService from "./scenarios.service.js";
import { ScenarioStatus } from "../../../generated/prisma/index.js";
import { NotFoundError } from "../../errors.js";

export const scenariosRouter = Router();
scenariosRouter.use(requireAuth, requireRole(PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR));

scenariosRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const input = scenarioAuthoringRequestSchema.parse(req.body);
    const job = await scenarioGenerationQueue.add("generate", {
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      request: input,
    });
    res.status(202).json({ jobId: job.id });
  }),
);

scenariosRouter.get(
  "/generate/:jobId",
  asyncHandler(async (req, res) => {
    const job = await scenarioGenerationQueue.getJob(req.params.jobId!);
    if (!job) throw new NotFoundError("Generation job not found");
    const state = await job.getState();
    res.json({ id: job.id, state, result: job.returnvalue ?? null, failedReason: job.failedReason ?? null });
  }),
);

scenariosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status ? (req.query.status as ScenarioStatus) : undefined;
    const scenarios = await scenariosService.listScenarios(req.auth!.tenantId, status);
    res.json({ scenarios });
  }),
);

scenariosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const scenario = await scenariosService.getScenario(req.auth!.tenantId, req.params.id!);
    res.json({ scenario });
  }),
);

const editScenarioSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  industry: z.string().min(1).max(80).optional(),
  narrative: z.string().min(1).max(4000).optional(),
  objectives: z.array(z.string().min(1).max(200)).optional(),
  winConditions: z.array(z.record(z.unknown())).optional(),
  lossConditions: z.array(z.record(z.unknown())).optional(),
  totalRounds: z.number().int().min(3).max(20).optional(),
  roundBudget: z.number().positive().optional(),
  baselineMetrics: z.record(z.unknown()).optional(),
  topology: z.record(z.unknown()).optional(),
  personas: z.array(z.record(z.unknown())).optional(),
  timeline: z.array(z.record(z.unknown())).optional(),
});

scenariosRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const patch = editScenarioSchema.parse(req.body);
    const scenario = await scenariosService.updateScenario(req.auth!.tenantId, req.params.id!, patch);
    res.json({ scenario });
  }),
);

scenariosRouter.post(
  "/:id/validate",
  asyncHandler(async (req, res) => {
    const result = await scenariosService.validateScenario(req.auth!.tenantId, req.params.id!);
    res.json(result);
  }),
);

scenariosRouter.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const scenario = await scenariosService.publishScenario(req.auth!.tenantId, req.params.id!);
    res.json({ scenario });
  }),
);

scenariosRouter.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    const scenario = await scenariosService.archiveScenario(req.auth!.tenantId, req.params.id!);
    res.json({ scenario });
  }),
);

scenariosRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await scenariosService.deleteDraftScenario(req.auth!.tenantId, req.params.id!);
    res.status(204).send();
  }),
);
