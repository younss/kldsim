import type { UUID } from "./common.js";

export type TopologyNodeKind =
  | "CAPABILITY"
  | "APPLICATION"
  | "DATA_STORE"
  | "INTEGRATION"
  | "EXTERNAL_PARTNER";

export type TopologyNodeHealth = "HEALTHY" | "AT_RISK" | "DEGRADED" | "CRITICAL";

export interface TopologyNode {
  id: UUID;
  kind: TopologyNodeKind;
  label: string;
  description: string;
  /** Normalized 3D layout position; the renderer treats this as a hint, not gospel. */
  position: { x: number; y: number; z: number };
  health: TopologyNodeHealth;
  /** 0-100, contributes to global technicalDebtIndex when aggregated. */
  debtLoad: number;
  /** true once modernized during the simulation. */
  modernized: boolean;
  isBottleneck: boolean;
}

export type TopologyEdgeKind = "DATA_FLOW" | "DEPENDENCY" | "API_CALL";

export interface TopologyEdge {
  id: UUID;
  source: UUID;
  target: UUID;
  kind: TopologyEdgeKind;
  /** Milliseconds of simulated latency; drives animated-flow speed in the 3D view. */
  latencyMs: number;
  /** 0-1, probability this edge fails under load this round. */
  fragility: number;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}
