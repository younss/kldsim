import { resolveRound, evaluateWinConditions, SOCKET_EVENTS } from "@kldsim/shared";
import type { EnterpriseMetrics, TopologyGraph, BudgetAllocation, NodeAction, TimelineEvent, WinCondition, SubmitDecisionInput } from "@kldsim/shared";
import { prisma } from "../../db.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors.js";
import { DecisionStatus, SessionStatus } from "../../../generated/prisma/index.js";
import { emitToSession, emitToTeam } from "../../realtime/socket.js";
import { scheduleRoundExpiry } from "../../jobs/queue.js";
import { getRoundNegotiationTrustDeltas } from "../negotiations/negotiations.service.js";
import { serializeTeam } from "../teams/teams.service.js";
import { toJson } from "../../lib/json.js";

const DEFAULT_ALLOCATION: BudgetAllocation = {
  modernization: 0.25,
  newFeatures: 0.25,
  riskMitigation: 0.25,
  stakeholderEngagement: 0.25,
};

async function assertActiveRound(sessionId: string, tenantId: string, roundNumber: number) {
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) throw new NotFoundError("Session not found");
  if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestError("Session is not in progress");
  if (roundNumber !== session.currentRound) throw new BadRequestError(`Round ${roundNumber} is not the active round (current: ${session.currentRound})`);
  return session;
}

export async function getDecision(sessionId: string, teamId: string, roundNumber: number) {
  return prisma.decision.findUnique({ where: { teamId_roundNumber: { teamId, roundNumber } } });
}

export async function saveDecisionDraft(tenantId: string, sessionId: string, teamId: string, roundNumber: number, input: SubmitDecisionInput) {
  await assertActiveRound(sessionId, tenantId, roundNumber);
  const existing = await getDecision(sessionId, teamId, roundNumber);
  if (existing?.status === DecisionStatus.SUBMITTED) {
    throw new ForbiddenError("This round's decision is already submitted and locked");
  }
  return prisma.decision.upsert({
    where: { teamId_roundNumber: { teamId, roundNumber } },
    create: { sessionId, teamId, roundNumber, status: DecisionStatus.DRAFT, allocation: input.allocation, nodeActions: input.nodeActions, rationale: input.rationale },
    update: { allocation: input.allocation, nodeActions: input.nodeActions, rationale: input.rationale },
  });
}

export async function submitDecision(tenantId: string, sessionId: string, teamId: string, roundNumber: number, userId: string, input: SubmitDecisionInput) {
  await assertActiveRound(sessionId, tenantId, roundNumber);
  const existing = await getDecision(sessionId, teamId, roundNumber);
  if (existing?.status === DecisionStatus.SUBMITTED) {
    throw new ForbiddenError("This round's decision is already submitted and locked");
  }

  const decision = await prisma.decision.upsert({
    where: { teamId_roundNumber: { teamId, roundNumber } },
    create: {
      sessionId,
      teamId,
      roundNumber,
      status: DecisionStatus.SUBMITTED,
      allocation: input.allocation,
      nodeActions: input.nodeActions,
      rationale: input.rationale,
      submittedAt: new Date(),
      submittedByUserId: userId,
    },
    update: {
      status: DecisionStatus.SUBMITTED,
      allocation: input.allocation,
      nodeActions: input.nodeActions,
      rationale: input.rationale,
      submittedAt: new Date(),
      submittedByUserId: userId,
    },
  });

  await prisma.telemetryEvent.create({ data: { sessionId, teamId, type: "DECISION_SUBMITTED", payload: { roundNumber } } });
  emitToSession(sessionId, SOCKET_EVENTS.DECISION_SUBMITTED, { teamId, roundNumber });
  return decision;
}

function buildNarrative(roundNumber: number, allocation: BudgetAllocation, appliedEvents: TimelineEvent[], autoResolved: boolean): string {
  const dominant = (Object.entries(allocation) as Array<[keyof BudgetAllocation, number]>).sort((a, b) => b[1] - a[1])[0]!;
  const focusLabel: Record<keyof BudgetAllocation, string> = {
    modernization: "platform modernization",
    newFeatures: "new feature delivery",
    riskMitigation: "risk mitigation",
    stakeholderEngagement: "stakeholder engagement",
  };
  const eventsText = appliedEvents.length > 0 ? appliedEvents.map((e) => e.title).join(", ") : "no scripted events";
  const prefix = autoResolved ? "No decision was submitted, so a neutral default allocation was auto-resolved. " : "";
  return `${prefix}Round ${roundNumber} closed with the team prioritizing ${focusLabel[dominant[0]]} (${Math.round(dominant[1] * 100)}% of budget). Triggered events: ${eventsText}.`;
}

/**
 * Resolves the current round for every active team in a session: pulls each
 * team's decision (or a neutral default if they never submitted), runs the
 * deterministic scoring engine, persists results, checks loss conditions,
 * advances the session state machine, and schedules the next round's timer.
 * This is the single call site every trigger (facilitator force-end, the
 * natural round-timer expiry, or a future "all teams submitted" auto-trigger)
 * goes through, so the state machine only has one implementation.
 */
export async function resolveRoundForSession(tenantId: string, sessionId: string) {
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId }, include: { teams: true } });
  if (!session) throw new NotFoundError("Session not found");
  if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestError("Session is not in progress");

  const scenario = await prisma.scenario.findUniqueOrThrow({ where: { id: session.scenarioId } });
  const timeline = scenario.timeline as unknown as TimelineEvent[];
  const lossConditions = scenario.lossConditions as unknown as WinCondition[];
  const roundNumber = session.currentRound;
  const isFinalRound = roundNumber >= scenario.totalRounds;

  const results = [];

  for (const team of session.teams) {
    if (team.eliminated) continue;

    const decision = await getDecision(sessionId, team.id, roundNumber);
    const allocation = (decision?.allocation as unknown as BudgetAllocation) ?? DEFAULT_ALLOCATION;
    const nodeActions = (decision?.nodeActions as unknown as NodeAction[]) ?? [];
    const negotiationTrustDeltas = await getRoundNegotiationTrustDeltas(team.id, roundNumber);

    const metricsBefore = team.metrics as unknown as EnterpriseMetrics;
    const { metricsAfter, topologyAfter, appliedEvents } = resolveRound({
      metricsBefore,
      topologyBefore: team.topology as unknown as TopologyGraph,
      allocation,
      nodeActions,
      roundBudget: scenario.roundBudget,
      roundNumber,
      timelineEvents: timeline,
      negotiationTrustDeltas,
    });

    const narrative = buildNarrative(roundNumber, allocation, appliedEvents, !decision);

    // Loss conditions are re-checked every round (not just at the final round), since a team can be
    // eliminated the moment stakeholderTrust collapses, for example, rather than only at scenario end.
    const lossChecks = evaluateWinConditions(metricsAfter, lossConditions, roundNumber, true);
    const eliminated = lossChecks.some((c) => c.met);

    await prisma.$transaction([
      prisma.team.update({ where: { id: team.id }, data: { metrics: toJson(metricsAfter), topology: toJson(topologyAfter), eliminated } }),
      prisma.decision.updateMany({ where: { teamId: team.id, roundNumber }, data: { status: DecisionStatus.RESOLVED } }),
      prisma.roundResult.create({
        data: {
          sessionId,
          teamId: team.id,
          roundNumber,
          metricsBefore: toJson(metricsBefore),
          metricsAfter: toJson(metricsAfter),
          appliedEvents: toJson(appliedEvents),
          narrative,
        },
      }),
      prisma.telemetryEvent.create({ data: { sessionId, teamId: team.id, type: "ROUND_RESOLVED", payload: toJson({ roundNumber, metricsAfter }) } }),
    ]);

    if (eliminated) {
      await prisma.telemetryEvent.create({ data: { sessionId, teamId: team.id, type: "TEAM_ELIMINATED", payload: toJson({ roundNumber, lossChecks }) } });
    }

    emitToTeam(sessionId, team.id, SOCKET_EVENTS.TEAM_TOPOLOGY_UPDATED, { teamId: team.id, topology: topologyAfter, metrics: metricsAfter });
    results.push({ sessionId, teamId: team.id, roundNumber, metricsBefore, metricsAfter, appliedEvents: appliedEvents.map((e) => e.id), narrative, resolvedAt: new Date().toISOString() });
  }

  const remainingActiveTeams = await prisma.team.count({ where: { sessionId, eliminated: false } });
  const shouldComplete = isFinalRound || remainingActiveTeams === 0;

  const updatedSession = await prisma.gameSession.update({
    where: { id: sessionId },
    data: shouldComplete
      ? { status: SessionStatus.COMPLETED, roundStartedAt: null }
      : { currentRound: roundNumber + 1, roundStartedAt: new Date(), pausedAt: null },
  });

  if (shouldComplete) {
    await prisma.telemetryEvent.create({ data: { sessionId, type: "SESSION_COMPLETED", payload: toJson({ finalRound: roundNumber }) } });
  } else {
    await scheduleRoundExpiry(tenantId, sessionId, roundNumber + 1, session.roundDurationSeconds * 1000);
    emitToSession(sessionId, SOCKET_EVENTS.ROUND_STARTED, { roundNumber: roundNumber + 1 });
  }

  emitToSession(sessionId, SOCKET_EVENTS.ROUND_RESOLVED, { roundNumber, results });
  const freshTeams = await prisma.team.findMany({ where: { sessionId }, include: { members: true } });
  emitToSession(sessionId, SOCKET_EVENTS.SESSION_STATE, { session: updatedSession, teams: freshTeams.map(serializeTeam) });

  return { session: updatedSession, results };
}

export async function getRoundHistory(sessionId: string, teamId?: string) {
  return prisma.roundResult.findMany({
    where: { sessionId, ...(teamId ? { teamId } : {}) },
    orderBy: [{ roundNumber: "asc" }, { teamId: "asc" }],
  });
}
