import { Queue } from "bullmq";
import type { ScenarioAuthoringRequest } from "@kldsim/shared";
import { createRedisClient } from "../redis.js";

export interface ScenarioGenerationJobData {
  tenantId: string;
  userId: string;
  request: ScenarioAuthoringRequest;
}

export interface ProposalEvaluationJobData {
  tenantId: string;
  sessionId: string;
  teamId: string;
  personaId: string;
  roundNumber: number;
  proposalMessageId: string;
  authorUserId: string;
}

export interface RoundTimerJobData {
  tenantId: string;
  sessionId: string;
  roundNumber: number;
}

export const scenarioGenerationQueue = new Queue<ScenarioGenerationJobData>("scenario-generation", {
  connection: createRedisClient("bullmq-scenario-queue"),
  defaultJobOptions: { attempts: 1, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86_400 } },
});

export const proposalEvaluationQueue = new Queue<ProposalEvaluationJobData>("proposal-evaluation", {
  connection: createRedisClient("bullmq-proposal-queue"),
  defaultJobOptions: { attempts: 2, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86_400 } },
});

export const roundTimerQueue = new Queue<RoundTimerJobData>("round-timer", {
  connection: createRedisClient("bullmq-round-timer-queue"),
  defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: true },
});

export function roundTimerJobId(sessionId: string, roundNumber: number): string {
  return `round-expiry:${sessionId}:${roundNumber}`;
}

/** Central helper so every caller (session start, resume, force-end, natural expiry) schedules round expiry the same way. */
export async function scheduleRoundExpiry(tenantId: string, sessionId: string, roundNumber: number, delayMs: number): Promise<void> {
  await roundTimerQueue.add(
    "expire",
    { tenantId, sessionId, roundNumber },
    { delay: Math.max(delayMs, 0), jobId: roundTimerJobId(sessionId, roundNumber) },
  );
}

export async function cancelRoundExpiry(sessionId: string, roundNumber: number): Promise<void> {
  const job = await roundTimerQueue.getJob(roundTimerJobId(sessionId, roundNumber));
  if (job) await job.remove().catch(() => undefined);
}
