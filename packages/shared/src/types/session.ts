import type { UUID, ISODateString } from "./common.js";
import type { EnterpriseMetrics, BudgetAllocation } from "./enterprise.js";
import type { TopologyGraph } from "./topology.js";

export type SessionStatus = "LOBBY" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

export interface GameSession {
  id: UUID;
  tenantId: UUID;
  scenarioId: UUID;
  facilitatorId: UUID;
  status: SessionStatus;
  currentRound: number;
  /** Seconds allotted per round; facilitator can override live. */
  roundDurationSeconds: number;
  roundStartedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Team {
  id: UUID;
  sessionId: UUID;
  name: string;
  memberUserIds: UUID[];
  metrics: EnterpriseMetrics;
  topology: TopologyGraph;
  eliminated: boolean;
}

export type DecisionStatus = "DRAFT" | "SUBMITTED" | "RESOLVED";

export interface NodeAction {
  nodeId: UUID;
  action: "MODERNIZE" | "DECOMMISSION" | "PATCH" | "IGNORE";
}

export interface Decision {
  id: UUID;
  sessionId: UUID;
  teamId: UUID;
  roundNumber: number;
  status: DecisionStatus;
  allocation: BudgetAllocation;
  nodeActions: NodeAction[];
  /** Free-text rationale players submit; scored for stakeholder-facing communication quality. */
  rationale: string;
  submittedAt: ISODateString | null;
  submittedByUserId: UUID | null;
}

export interface RoundResult {
  sessionId: UUID;
  teamId: UUID;
  roundNumber: number;
  metricsBefore: EnterpriseMetrics;
  metricsAfter: EnterpriseMetrics;
  appliedEvents: string[];
  narrative: string;
  resolvedAt: ISODateString;
}
