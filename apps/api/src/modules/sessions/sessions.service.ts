import type { EnterpriseMetrics } from "@kldsim/shared";
import { SOCKET_EVENTS } from "@kldsim/shared";
import { prisma } from "../../db.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors.js";
import { SessionStatus, ScenarioStatus } from "../../../generated/prisma/index.js";
import { emitToSession } from "../../realtime/socket.js";
import { scheduleRoundExpiry, cancelRoundExpiry } from "../../jobs/queue.js";
import { resolveRoundForSession } from "../rounds/rounds.service.js";
import { toJson } from "../../lib/json.js";
import { serializeTeam } from "../teams/teams.service.js";

export async function listSessions(tenantId: string) {
  return prisma.gameSession.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, include: { scenario: { select: { title: true } } } });
}

export async function listSessionsForUser(tenantId: string, userId: string) {
  return prisma.gameSession.findMany({
    where: {
      tenantId,
      OR: [{ facilitatorId: userId }, { teams: { some: { members: { some: { userId } } } } }],
    },
    orderBy: { createdAt: "desc" },
    include: { scenario: { select: { title: true } } },
  });
}

export async function getSession(tenantId: string, id: string) {
  const session = await prisma.gameSession.findFirst({
    where: { id, tenantId },
    include: { teams: { include: { members: true } }, scenario: true },
  });
  if (!session) throw new NotFoundError("Session not found");
  return { ...session, teams: session.teams.map(serializeTeam) };
}

export async function createSession(tenantId: string, facilitatorId: string, scenarioId: string, roundDurationSeconds: number) {
  const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, tenantId } });
  if (!scenario) throw new NotFoundError("Scenario not found");
  if (scenario.status !== ScenarioStatus.PUBLISHED) {
    throw new BadRequestError("Only a published scenario can be used to start a session", "SCENARIO_NOT_PUBLISHED");
  }
  return prisma.gameSession.create({
    data: { tenantId, scenarioId, facilitatorId, roundDurationSeconds, status: SessionStatus.LOBBY },
  });
}

export async function startSession(tenantId: string, sessionId: string) {
  const session = await getSession(tenantId, sessionId);
  if (session.status !== SessionStatus.LOBBY) throw new BadRequestError("Session has already started");
  if (session.teams.length === 0) throw new BadRequestError("Add at least one team before starting", "NO_TEAMS");

  const now = new Date();
  const updated = await prisma.gameSession.update({
    where: { id: sessionId },
    data: { status: SessionStatus.IN_PROGRESS, currentRound: 1, roundStartedAt: now, pausedAt: null },
  });

  await scheduleRoundExpiry(tenantId, sessionId, 1, session.roundDurationSeconds * 1000);
  emitToSession(sessionId, SOCKET_EVENTS.ROUND_STARTED, { roundNumber: 1 });
  await broadcastSessionState(tenantId, sessionId);
  return updated;
}

export async function pauseSession(tenantId: string, sessionId: string, facilitatorId: string) {
  const session = await getSession(tenantId, sessionId);
  if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestError("Session is not in progress");

  await cancelRoundExpiry(sessionId, session.currentRound);
  const updated = await prisma.gameSession.update({
    where: { id: sessionId },
    data: { status: SessionStatus.PAUSED, pausedAt: new Date() },
  });
  await logOverride(sessionId, facilitatorId, "PAUSE_SESSION", {});
  await broadcastSessionState(tenantId, sessionId);
  return updated;
}

export async function resumeSession(tenantId: string, sessionId: string, facilitatorId: string) {
  const session = await getSession(tenantId, sessionId);
  if (session.status !== SessionStatus.PAUSED || !session.pausedAt || !session.roundStartedAt) {
    throw new BadRequestError("Session is not paused");
  }

  const elapsedBeforePauseMs = session.pausedAt.getTime() - session.roundStartedAt.getTime();
  const remainingMs = session.roundDurationSeconds * 1000 - elapsedBeforePauseMs;
  const now = new Date();
  // Shift roundStartedAt so that (now - roundStartedAt) still equals the elapsed time accrued before the pause.
  const adjustedRoundStartedAt = new Date(now.getTime() - elapsedBeforePauseMs);

  const updated = await prisma.gameSession.update({
    where: { id: sessionId },
    data: { status: SessionStatus.IN_PROGRESS, pausedAt: null, roundStartedAt: adjustedRoundStartedAt },
  });

  await scheduleRoundExpiry(tenantId, sessionId, session.currentRound, remainingMs);
  await logOverride(sessionId, facilitatorId, "RESUME_SESSION", {});
  await broadcastSessionState(tenantId, sessionId);
  return updated;
}

export async function extendTimer(tenantId: string, sessionId: string, facilitatorId: string, additionalSeconds: number) {
  const session = await getSession(tenantId, sessionId);
  if (session.status !== SessionStatus.IN_PROGRESS || !session.roundStartedAt) {
    throw new BadRequestError("Session is not in progress");
  }

  const newDuration = session.roundDurationSeconds + additionalSeconds;
  const elapsedMs = Date.now() - session.roundStartedAt.getTime();
  const remainingMs = newDuration * 1000 - elapsedMs;

  const updated = await prisma.gameSession.update({ where: { id: sessionId }, data: { roundDurationSeconds: newDuration } });
  await cancelRoundExpiry(sessionId, session.currentRound);
  await scheduleRoundExpiry(tenantId, sessionId, session.currentRound, remainingMs);
  await logOverride(sessionId, facilitatorId, "EXTEND_TIMER", { additionalSeconds });
  await broadcastSessionState(tenantId, sessionId);
  return updated;
}

export async function forceRoundEnd(tenantId: string, sessionId: string, facilitatorId: string) {
  const session = await getSession(tenantId, sessionId);
  if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestError("Session is not in progress");
  await cancelRoundExpiry(sessionId, session.currentRound);
  await logOverride(sessionId, facilitatorId, "FORCE_ROUND_END", {});
  return resolveRoundForSession(tenantId, sessionId);
}

export interface InjectedEvent {
  title: string;
  description: string;
  metricImpact: Partial<EnterpriseMetrics>;
}

/** Facilitator manual event injection: applies an immediate, deterministic metric shock to every active team right now (not tied to the scenario's authored timeline). */
export async function injectEvent(tenantId: string, sessionId: string, facilitatorId: string, event: InjectedEvent) {
  const session = await getSession(tenantId, sessionId);
  if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestError("Session is not in progress");

  for (const team of session.teams) {
    if (team.eliminated) continue;
    const metrics = team.metrics;
    const next: EnterpriseMetrics = {
      tco: metrics.tco + (event.metricImpact.tco ?? 0),
      technicalDebtIndex: clamp(metrics.technicalDebtIndex + (event.metricImpact.technicalDebtIndex ?? 0)),
      deliveryVelocity: clamp(metrics.deliveryVelocity + (event.metricImpact.deliveryVelocity ?? 0)),
      stakeholderTrust: clamp(metrics.stakeholderTrust + (event.metricImpact.stakeholderTrust ?? 0)),
    };
    await prisma.team.update({ where: { id: team.id }, data: { metrics: toJson(next) } });
    await prisma.telemetryEvent.create({
      data: { sessionId, teamId: team.id, type: "EVENT_TRIGGERED", payload: toJson({ title: event.title, description: event.description, injected: true }) },
    });
  }

  await logOverride(sessionId, facilitatorId, "INJECT_EVENT", event);
  emitToSession(sessionId, SOCKET_EVENTS.FACILITATOR_OVERRIDE, { kind: "INJECT_EVENT", sessionId, facilitatorId, payload: event, issuedAt: new Date().toISOString() });
  await broadcastSessionState(tenantId, sessionId);
}

export async function broadcastMessage(tenantId: string, sessionId: string, facilitatorId: string, message: string) {
  await getSession(tenantId, sessionId);
  await logOverride(sessionId, facilitatorId, "BROADCAST_MESSAGE", { message });
  emitToSession(sessionId, SOCKET_EVENTS.FACILITATOR_OVERRIDE, { kind: "BROADCAST_MESSAGE", sessionId, facilitatorId, payload: { message }, issuedAt: new Date().toISOString() });
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

async function logOverride(sessionId: string, facilitatorId: string, kind: string, payload: unknown) {
  await prisma.facilitatorOverrideLog.create({ data: { sessionId, facilitatorId, kind, payload: toJson(payload) } });
}

export async function broadcastSessionState(tenantId: string, sessionId: string) {
  const session = await getSession(tenantId, sessionId);
  emitToSession(sessionId, SOCKET_EVENTS.SESSION_STATE, { session, teams: session.teams });
}

export async function getWarRoomSnapshot(tenantId: string, sessionId: string) {
  const session = await getSession(tenantId, sessionId);
  const decisions = await prisma.decision.findMany({ where: { sessionId, roundNumber: session.currentRound } });
  const recentTelemetry = await prisma.telemetryEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: 50 });
  const overrides = await prisma.facilitatorOverrideLog.findMany({ where: { sessionId }, orderBy: { issuedAt: "desc" }, take: 20 });

  return {
    session,
    decisionStatusByTeam: session.teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      status: decisions.find((d) => d.teamId === team.id)?.status ?? "DRAFT",
    })),
    recentTelemetry,
    overrides,
  };
}
