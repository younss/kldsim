import type { UUID, ISODateString } from "./common.js";

export type TelemetryEventType =
  | "TEAM_JOINED"
  | "DECISION_SUBMITTED"
  | "ROUND_STARTED"
  | "ROUND_RESOLVED"
  | "NEGOTIATION_MESSAGE"
  | "FACILITATOR_OVERRIDE"
  | "EVENT_TRIGGERED"
  | "TEAM_ELIMINATED"
  | "SESSION_COMPLETED";

export interface TelemetryEvent {
  id: UUID;
  sessionId: UUID;
  teamId: UUID | null;
  type: TelemetryEventType;
  payload: Record<string, unknown>;
  createdAt: ISODateString;
}

export type FacilitatorOverrideKind =
  | "EXTEND_TIMER"
  | "FORCE_ROUND_END"
  | "INJECT_EVENT"
  | "PAUSE_SESSION"
  | "RESUME_SESSION"
  | "BROADCAST_MESSAGE";

export interface FacilitatorOverride {
  kind: FacilitatorOverrideKind;
  sessionId: UUID;
  facilitatorId: UUID;
  payload: Record<string, unknown>;
  issuedAt: ISODateString;
}
