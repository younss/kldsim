import { Worker } from "bullmq";
import { createRedisClient } from "../../redis.js";
import { logger } from "../../logger.js";
import { prisma } from "../../db.js";
import { resolveRoundForSession } from "../../modules/rounds/rounds.service.js";
import { SessionStatus } from "../../../generated/prisma/index.js";
import type { RoundTimerJobData } from "../queue.js";

/**
 * Fires once per round after roundDurationSeconds elapses. Re-validates
 * status and round number before resolving because a facilitator's
 * force-end (or a pause) may have already changed session state between
 * when this job was scheduled and when it actually runs.
 */
export function startRoundTimerWorker(): Worker<RoundTimerJobData> {
  return new Worker<RoundTimerJobData>(
    "round-timer",
    async (job) => {
      const { tenantId, sessionId, roundNumber } = job.data;
      const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId } });
      if (!session || session.status !== SessionStatus.IN_PROGRESS || session.currentRound !== roundNumber) {
        return;
      }
      await resolveRoundForSession(tenantId, sessionId);
    },
    { connection: createRedisClient("bullmq-round-timer-worker"), concurrency: 5 },
  ).on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Round timer job failed");
  });
}
