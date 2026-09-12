import { Worker } from "bullmq";
import { SOCKET_EVENTS } from "@kldsim/shared";
import { createRedisClient } from "../../redis.js";
import { logger } from "../../logger.js";
import { getTenantGateway } from "../../modules/providers/providers.service.js";
import { generateScenarioPayload } from "../../modules/scenarios/scenarioGenerator.service.js";
import { createDraftScenario } from "../../modules/scenarios/scenarios.service.js";
import { emitToUser } from "../../realtime/socket.js";
import type { ScenarioGenerationJobData } from "../queue.js";

export function startScenarioGenerationWorker(): Worker<ScenarioGenerationJobData> {
  return new Worker<ScenarioGenerationJobData>(
    "scenario-generation",
    async (job) => {
      const { tenantId, userId, request } = job.data;
      emitToUser(tenantId, userId, SOCKET_EVENTS.STUDIO_GENERATION_PROGRESS, { jobId: job.id, status: "GENERATING" });

      const gateway = await getTenantGateway(tenantId, request.providerOverride);
      const { generated, providerUsed, modelUsed } = await generateScenarioPayload(gateway, request);

      emitToUser(tenantId, userId, SOCKET_EVENTS.STUDIO_GENERATION_PROGRESS, { jobId: job.id, status: "VALIDATING" });
      const scenario = await createDraftScenario(tenantId, userId, request.prompt, generated);

      emitToUser(tenantId, userId, SOCKET_EVENTS.STUDIO_GENERATION_COMPLETED, {
        jobId: job.id,
        scenarioId: scenario.id,
        providerUsed,
        modelUsed,
      });

      return { scenarioId: scenario.id };
    },
    { connection: createRedisClient("bullmq-scenario-worker"), concurrency: 2 },
  ).on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Scenario generation job failed");
    if (job) {
      emitToUser(job.data.tenantId, job.data.userId, SOCKET_EVENTS.STUDIO_GENERATION_FAILED, {
        jobId: job.id,
        message: err instanceof Error ? err.message : "Scenario generation failed",
      });
    }
  });
}
