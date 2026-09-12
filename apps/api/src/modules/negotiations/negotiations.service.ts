import { NegotiationSpeaker } from "../../../generated/prisma/index.js";
import type { GameSession as PrismaGameSession, Team as PrismaTeam, Scenario as PrismaScenario } from "../../../generated/prisma/index.js";
import type { StakeholderPersona, EnterpriseMetrics } from "@kldsim/shared";
import { clamp100, proposalEvaluationSchema, SOCKET_EVENTS } from "@kldsim/shared";
import type { LLMGateway, ChatMessage, PersonaContext } from "@kldsim/llm-gateway";
import { buildPersonaNegotiationMessages, buildProposalEvaluationMessages } from "@kldsim/llm-gateway";
import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { NotFoundError } from "../../errors.js";
import { emitToTeam, emitToSession } from "../../realtime/socket.js";

const HISTORY_LIMIT = 24;

function getPersona(scenario: PrismaScenario, personaId: string): StakeholderPersona {
  const personas = scenario.personas as unknown as StakeholderPersona[];
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) throw new NotFoundError("Persona not found in this scenario", "PERSONA_NOT_FOUND");
  return persona;
}

async function getOrCreateTrustState(sessionId: string, teamId: string, persona: StakeholderPersona) {
  const existing = await prisma.personaTrustState.findUnique({ where: { teamId_personaId: { teamId, personaId: persona.id } } });
  if (existing) return existing;
  return prisma.personaTrustState.create({
    data: { sessionId, teamId, personaId: persona.id, currentTrust: persona.initialTrust },
  });
}

async function buildPersonaContext(
  session: PrismaGameSession,
  team: PrismaTeam,
  scenario: PrismaScenario,
  persona: StakeholderPersona,
): Promise<PersonaContext> {
  const trustState = await getOrCreateTrustState(session.id, team.id, persona);
  return {
    persona,
    scenarioNarrative: scenario.narrative,
    currentMetrics: team.metrics as unknown as EnterpriseMetrics,
    currentTrustInTeam: trustState.currentTrust,
    roundNumber: session.currentRound,
    totalRounds: scenario.totalRounds,
  };
}

async function getConversationHistory(teamId: string, personaId: string): Promise<ChatMessage[]> {
  const recentDesc = await prisma.negotiationMessage.findMany({
    where: { teamId, personaId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const messages = recentDesc.reverse();
  return messages.map((m) => ({
    role: m.speaker === NegotiationSpeaker.PERSONA ? "assistant" : "user",
    content: m.speaker === NegotiationSpeaker.SYSTEM ? `(scenario event) ${m.content}` : m.content,
  }));
}

interface LoadedContext {
  session: PrismaGameSession;
  team: PrismaTeam;
  scenario: PrismaScenario;
  persona: StakeholderPersona;
}

async function loadContext(tenantId: string, sessionId: string, teamId: string, personaId: string): Promise<LoadedContext> {
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) throw new NotFoundError("Session not found");
  const team = await prisma.team.findFirst({ where: { id: teamId, sessionId } });
  if (!team) throw new NotFoundError("Team not found");
  const scenario = await prisma.scenario.findUniqueOrThrow({ where: { id: session.scenarioId } });
  const persona = getPersona(scenario, personaId);
  return { session, team, scenario, persona };
}

/**
 * Live roleplay channel: streams the persona's reply token-by-token for
 * immersion. Deliberately unscored — this is the "conversation," not the
 * "proposal." A team can banter here indefinitely without moving any metric.
 */
export async function streamChatReply(
  gateway: LLMGateway,
  tenantId: string,
  sessionId: string,
  teamId: string,
  personaId: string,
  authorUserId: string,
  content: string,
): Promise<void> {
  const { session, team, scenario, persona } = await loadContext(tenantId, sessionId, teamId, personaId);
  const history = await getConversationHistory(teamId, personaId);

  const playerMessage = await prisma.negotiationMessage.create({
    data: {
      sessionId,
      teamId,
      personaId,
      roundNumber: session.currentRound,
      speaker: NegotiationSpeaker.PLAYER,
      authorUserId,
      content,
    },
  });
  emitToTeam(sessionId, teamId, SOCKET_EVENTS.NEGOTIATION_MESSAGE, playerMessage);

  const ctx = await buildPersonaContext(session, team, scenario, persona);
  const messages = buildPersonaNegotiationMessages(ctx, [...history, { role: "user", content }]);

  let full = "";
  try {
    for await (const chunk of gateway.streamText({ messages, temperature: 0.8, maxTokens: 500 })) {
      if (chunk.delta) {
        full += chunk.delta;
        emitToTeam(sessionId, teamId, SOCKET_EVENTS.NEGOTIATION_STREAM_CHUNK, { teamId, personaId, delta: chunk.delta });
      }
    }
  } catch (err) {
    logger.error({ err, sessionId, teamId, personaId }, "Persona chat stream failed");
    full = `${persona.name} is momentarily unavailable — the connection to the configured AI provider failed.`;
  }

  const personaMessage = await prisma.negotiationMessage.create({
    data: { sessionId, teamId, personaId, roundNumber: session.currentRound, speaker: NegotiationSpeaker.PERSONA, content: full },
  });
  emitToTeam(sessionId, teamId, SOCKET_EVENTS.NEGOTIATION_STREAM_DONE, { teamId, personaId, message: personaMessage });
}

/** Formal, scored path: persists the proposal immediately and returns — evaluation happens in the background worker. */
export async function submitProposal(
  tenantId: string,
  sessionId: string,
  teamId: string,
  personaId: string,
  authorUserId: string,
  proposalText: string,
) {
  const { session } = await loadContext(tenantId, sessionId, teamId, personaId);
  const message = await prisma.negotiationMessage.create({
    data: {
      sessionId,
      teamId,
      personaId,
      roundNumber: session.currentRound,
      speaker: NegotiationSpeaker.PLAYER,
      authorUserId,
      content: proposalText,
    },
  });
  emitToTeam(sessionId, teamId, SOCKET_EVENTS.NEGOTIATION_MESSAGE, message);
  return message;
}

/** Runs inside the proposal-evaluation worker. */
export async function resolveProposalEvaluation(
  gateway: LLMGateway,
  tenantId: string,
  sessionId: string,
  teamId: string,
  personaId: string,
  proposalMessageId: string,
): Promise<void> {
  const { session, team, scenario, persona } = await loadContext(tenantId, sessionId, teamId, personaId);
  const proposalMessage = await prisma.negotiationMessage.findUniqueOrThrow({ where: { id: proposalMessageId } });
  // The proposal itself is already persisted, so it's the last entry here — drop it since
  // buildProposalEvaluationMessages re-embeds its text in the final instruction turn.
  const priorHistory = (await getConversationHistory(teamId, personaId)).slice(0, -1);
  const ctx = await buildPersonaContext(session, team, scenario, persona);

  const { data: evaluation } = await gateway.generateJSON({
    messages: buildProposalEvaluationMessages(ctx, proposalMessage.content, priorHistory),
    schema: proposalEvaluationSchema,
    schemaName: "ProposalEvaluation",
    temperature: 0.4,
    maxTokens: 1000,
  });

  const trustState = await getOrCreateTrustState(sessionId, teamId, persona);
  const newTrust = clamp100(trustState.currentTrust + evaluation.trustDelta);
  await prisma.personaTrustState.update({ where: { id: trustState.id }, data: { currentTrust: newTrust } });

  const personaMessage = await prisma.negotiationMessage.create({
    data: {
      sessionId,
      teamId,
      personaId,
      roundNumber: session.currentRound,
      speaker: NegotiationSpeaker.PERSONA,
      content: evaluation.personaReplyMessage,
      trustDelta: evaluation.trustDelta,
      evaluationDetail: {
        empathyScore: evaluation.empathyScore,
        financialAcumenScore: evaluation.financialAcumenScore,
        strategicAlignmentScore: evaluation.strategicAlignmentScore,
        rationale: evaluation.rationale,
      },
    },
  });

  await prisma.telemetryEvent.create({
    data: {
      sessionId,
      teamId,
      type: "NEGOTIATION_MESSAGE",
      payload: { personaId, personaName: persona.name, trustDelta: evaluation.trustDelta, excerpt: proposalMessage.content.slice(0, 140) },
    },
  });

  emitToTeam(sessionId, teamId, SOCKET_EVENTS.NEGOTIATION_PROPOSAL_EVALUATED, {
    teamId,
    personaId,
    message: personaMessage,
    trustDelta: evaluation.trustDelta,
    newTrust,
  });
  emitToSession(sessionId, SOCKET_EVENTS.TELEMETRY_EVENT, {
    sessionId,
    teamId,
    type: "NEGOTIATION_MESSAGE",
    payload: { personaName: persona.name, trustDelta: evaluation.trustDelta },
    createdAt: new Date().toISOString(),
  });
}

/** Sum of scored trustDelta values recorded for a team during a specific round — feeds the round-resolution scoring engine. */
export async function getRoundNegotiationTrustDeltas(teamId: string, roundNumber: number): Promise<number[]> {
  const messages = await prisma.negotiationMessage.findMany({
    where: { teamId, roundNumber, trustDelta: { not: null } },
    select: { trustDelta: true },
  });
  return messages.map((m) => m.trustDelta!).filter((d): d is number => d !== null);
}

export async function checkTeamMembership(teamId: string, userId: string): Promise<boolean> {
  const membership = await prisma.teamMember.findFirst({ where: { teamId, userId } });
  return Boolean(membership);
}
