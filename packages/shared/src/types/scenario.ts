import type { UUID, ISODateString } from "./common.js";
import type { EnterpriseMetrics, WinCondition } from "./enterprise.js";
import type { TopologyGraph } from "./topology.js";
import type { StakeholderPersona } from "./persona.js";

export type TimelineEventKind =
  | "MARKET_DISRUPTION"
  | "AUDIT_TRIGGER"
  | "CRISIS"
  | "OPPORTUNITY";

export interface TimelineEvent {
  id: UUID;
  roundNumber: number;
  kind: TimelineEventKind;
  title: string;
  description: string;
  /** Direct, deterministic metric shocks applied when the event fires. */
  metricImpact: Partial<EnterpriseMetrics>;
  /** IDs of topology nodes this event pushes toward CRITICAL / marks as bottlenecks. */
  affectedNodeIds: UUID[];
}

export type ScenarioStatus = "DRAFT" | "VALIDATED" | "PUBLISHED" | "ARCHIVED";

export interface Scenario {
  id: UUID;
  tenantId: UUID;
  status: ScenarioStatus;
  title: string;
  industry: string;
  narrative: string;
  /** The plain-text prompt the facilitator/admin originally supplied to the Game Studio. */
  authoringPrompt: string;
  objectives: string[];
  winConditions: WinCondition[];
  lossConditions: WinCondition[];
  totalRounds: number;
  roundBudget: number;
  baselineMetrics: EnterpriseMetrics;
  topology: TopologyGraph;
  personas: StakeholderPersona[];
  timeline: TimelineEvent[];
  createdBy: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Shape the LLM must return for scenario synthesis — everything except server-assigned identity/audit fields. */
export type GeneratedScenarioPayload = Omit<
  Scenario,
  "id" | "tenantId" | "status" | "createdBy" | "createdAt" | "updatedAt" | "authoringPrompt"
>;
