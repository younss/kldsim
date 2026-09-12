import type { UUID, ISODateString } from "./common.js";

export type NegotiationSpeaker = "PLAYER" | "PERSONA" | "SYSTEM";

export interface NegotiationEvaluationDetail {
  empathyScore: number;
  financialAcumenScore: number;
  strategicAlignmentScore: number;
  rationale: string;
}

export interface NegotiationMessage {
  id: UUID;
  sessionId: UUID;
  teamId: UUID;
  personaId: UUID;
  roundNumber: number;
  speaker: NegotiationSpeaker;
  authorUserId: UUID | null;
  content: string;
  /** Present only on a PERSONA message produced by a scored proposal evaluation. */
  trustDelta: number | null;
  evaluationDetail: NegotiationEvaluationDetail | null;
  createdAt: ISODateString;
}

/** Structured output the LLM must return when scoring a player's proposal to a persona. */
export interface ProposalEvaluation {
  empathyScore: number;
  financialAcumenScore: number;
  strategicAlignmentScore: number;
  /** -100..100, net change to this persona's trust in the team. */
  trustDelta: number;
  rationale: string;
  personaReplyMessage: string;
}
