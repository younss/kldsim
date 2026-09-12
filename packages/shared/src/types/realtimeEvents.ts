import type { UUID } from "./common.js";
import type { EnterpriseMetrics } from "./enterprise.js";
import type { GameSession, Team, RoundResult } from "./session.js";
import type { NegotiationMessage } from "./negotiation.js";
import type { TelemetryEvent, FacilitatorOverride } from "./telemetry.js";

/**
 * Socket.IO event name constants shared verbatim between apps/api and
 * apps/web so client and server can never drift on a string literal.
 */
export const SOCKET_EVENTS = {
  STUDIO_GENERATION_PROGRESS: "studio:generation:progress",
  STUDIO_GENERATION_COMPLETED: "studio:generation:completed",
  STUDIO_GENERATION_FAILED: "studio:generation:failed",

  JOIN_SESSION: "join:session",
  JOIN_TEAM: "join:team",
  SESSION_STATE: "session:state",

  ROUND_STARTED: "round:started",
  ROUND_RESOLVED: "round:resolved",
  DECISION_SUBMITTED: "decision:submitted",
  TEAM_TOPOLOGY_UPDATED: "team:topology:updated",

  SEND_NEGOTIATION_MESSAGE: "negotiation:send",
  NEGOTIATION_MESSAGE: "negotiation:message",
  NEGOTIATION_STREAM_CHUNK: "negotiation:stream:chunk",
  NEGOTIATION_STREAM_DONE: "negotiation:stream:done",
  NEGOTIATION_PROPOSAL_QUEUED: "negotiation:proposal:queued",
  NEGOTIATION_PROPOSAL_EVALUATED: "negotiation:proposal:evaluated",

  TELEMETRY_EVENT: "telemetry:event",
  FACILITATOR_OVERRIDE: "facilitator:override",

  ERROR: "error",
} as const;

export interface StudioGenerationProgressPayload {
  jobId: string;
  status: "QUEUED" | "GENERATING" | "VALIDATING";
}

export interface StudioGenerationCompletedPayload {
  jobId: string;
  scenarioId: UUID;
  providerUsed: string;
  modelUsed: string;
}

export interface StudioGenerationFailedPayload {
  jobId: string;
  message: string;
}

export interface SessionStatePayload {
  session: GameSession;
  teams: Team[];
}

export interface RoundResolvedPayload {
  roundNumber: number;
  results: RoundResult[];
}

export interface DecisionSubmittedPayload {
  teamId: UUID;
  roundNumber: number;
}

export interface TeamTopologyUpdatedPayload {
  teamId: UUID;
  topology: Team["topology"];
  metrics: EnterpriseMetrics;
}

export interface NegotiationStreamChunkPayload {
  teamId: UUID;
  personaId: UUID;
  delta: string;
}

export interface NegotiationStreamDonePayload {
  teamId: UUID;
  personaId: UUID;
  message: NegotiationMessage;
}

export interface NegotiationProposalQueuedPayload {
  teamId: UUID;
  personaId: UUID;
  jobId: string;
}

export interface NegotiationProposalEvaluatedPayload {
  teamId: UUID;
  personaId: UUID;
  message: NegotiationMessage;
  trustDelta: number;
  newTrust: number;
}

export type TelemetryEventPayload = TelemetryEvent;
export type FacilitatorOverridePayload = FacilitatorOverride;
