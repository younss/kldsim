import { Worker } from "bullmq";
import { createRedisClient } from "../../redis.js";
import { logger } from "../../logger.js";
import { getTenantGateway } from "../../modules/providers/providers.service.js";
import { resolveProposalEvaluation } from "../../modules/negotiations/negotiations.service.js";
import type { ProposalEvaluationJobData } from "../queue.js";

export function startProposalEvaluationWorker(): Worker<ProposalEvaluationJobData> {
  return new Worker<ProposalEvaluationJobData>(
    "proposal-evaluation",
    async (job) => {
      const { tenantId, sessionId, teamId, personaId, proposalMessageId } = job.data;
      const gateway = await getTenantGateway(tenantId);
      await resolveProposalEvaluation(gateway, tenantId, sessionId, teamId, personaId, proposalMessageId);
    },
    { connection: createRedisClient("bullmq-proposal-worker"), concurrency: 4 },
  ).on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "Proposal evaluation job failed");
  });
}
