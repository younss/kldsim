import type { EnterpriseMetrics, BudgetAllocation, WinCondition } from "../types/enterprise.js";
import type { TopologyGraph, TopologyNodeHealth } from "../types/topology.js";
import type { NodeAction } from "../types/session.js";
import type { TimelineEvent } from "../types/scenario.js";
import { clamp100, roundTo } from "../utils/clamp.js";
import { SCORING_CONSTANTS, ALLOCATION_KEYS } from "./constants.js";

export class InvalidAllocationError extends Error {}

/**
 * A team's allocation fractions must sum to 1.0 (within floating-point
 * tolerance) and every fraction must be non-negative. This is the only
 * validation gate before decisions are persisted as SUBMITTED.
 */
export function validateAllocation(allocation: BudgetAllocation, epsilon = 0.01): void {
  const sum = ALLOCATION_KEYS.reduce((acc, key) => acc + allocation[key], 0);
  if (Math.abs(sum - 1) > epsilon) {
    throw new InvalidAllocationError(`Budget allocation must sum to 1.0, got ${sum.toFixed(4)}`);
  }
  for (const key of ALLOCATION_KEYS) {
    if (allocation[key] < 0) {
      throw new InvalidAllocationError(`Allocation.${key} cannot be negative, got ${allocation[key]}`);
    }
  }
}

export function computeNodeHealth(debtLoad: number): TopologyNodeHealth {
  if (debtLoad >= 75) return "CRITICAL";
  if (debtLoad >= 50) return "DEGRADED";
  if (debtLoad >= 25) return "AT_RISK";
  return "HEALTHY";
}

export interface ApplyNodeActionsResult {
  topology: TopologyGraph;
  /** Sum across all nodes of (debtBefore - debtAfter); negative when net debt rose. */
  debtReduced: number;
}

/**
 * Applies each team's per-node engineering actions to their private topology
 * copy. Nodes with no submitted action still drift (organizational entropy);
 * nodes explicitly IGNOREd drift faster than untouched ones since IGNORE is
 * a conscious deferral, not an oversight.
 */
export function applyNodeActions(topology: TopologyGraph, actions: NodeAction[]): ApplyNodeActionsResult {
  const actionByNode = new Map(actions.map((a) => [a.nodeId, a.action]));
  let debtReduced = 0;

  const nodes = topology.nodes.map((node) => {
    const action = actionByNode.get(node.id);

    if (!action || action === "IGNORE") {
      const drift = action === "IGNORE"
        ? SCORING_CONSTANTS.NODE_PASSIVE_DRIFT_IGNORED
        : SCORING_CONSTANTS.NODE_PASSIVE_DRIFT_UNTOUCHED;
      const nextDebt = clamp100(node.debtLoad + drift);
      debtReduced += node.debtLoad - nextDebt;
      return { ...node, debtLoad: nextDebt, health: computeNodeHealth(nextDebt), isBottleneck: nextDebt >= 70 };
    }

    let nextDebt = node.debtLoad;
    let modernized = node.modernized;
    if (action === "MODERNIZE") {
      nextDebt = clamp100(node.debtLoad - SCORING_CONSTANTS.NODE_MODERNIZE_DEBT_REDUCTION);
      modernized = true;
    } else if (action === "PATCH") {
      nextDebt = clamp100(node.debtLoad - SCORING_CONSTANTS.NODE_PATCH_DEBT_REDUCTION);
    } else if (action === "DECOMMISSION") {
      nextDebt = 0;
      modernized = true;
    }

    debtReduced += node.debtLoad - nextDebt;
    return { ...node, debtLoad: nextDebt, modernized, health: computeNodeHealth(nextDebt), isBottleneck: nextDebt >= 70 };
  });

  return { topology: { nodes, edges: topology.edges }, debtReduced };
}

export interface ResolveRoundInput {
  metricsBefore: EnterpriseMetrics;
  topologyBefore: TopologyGraph;
  allocation: BudgetAllocation;
  nodeActions: NodeAction[];
  roundBudget: number;
  roundNumber: number;
  /** Full scenario timeline; the engine filters for events matching roundNumber. */
  timelineEvents: TimelineEvent[];
  /** Raw trustDelta values (-100..100) collected from proposal evaluations resolved this round. */
  negotiationTrustDeltas: number[];
}

export interface ResolveRoundOutput {
  metricsAfter: EnterpriseMetrics;
  topologyAfter: TopologyGraph;
  appliedEvents: TimelineEvent[];
}

/**
 * The single deterministic entry point for turning one team's round-N
 * decisions into round-(N+1) state. Pure function: same input always
 * produces the same output, which is what makes replay/debrief exact.
 *
 * Node actions and budget allocation intentionally operate on two different
 * scales: node actions are surgical (visible instantly on that node in the
 * 3D view, blended into the enterprise index at 1/nodeCount weight) while
 * allocation percentages are strategic (move the enterprise-wide index
 * directly). Both are required levers, neither alone is sufficient to win.
 */
export function resolveRound(input: ResolveRoundInput): ResolveRoundOutput {
  validateAllocation(input.allocation);
  const { metricsBefore, allocation, roundBudget, nodeActions, topologyBefore, roundNumber } = input;

  const { topology: topologyAfter, debtReduced } = applyNodeActions(topologyBefore, nodeActions);
  const nodeDrivenTdiDelta = topologyAfter.nodes.length > 0 ? -(debtReduced / topologyAfter.nodes.length) : 0;

  const appliedEvents = input.timelineEvents.filter((e) => e.roundNumber === roundNumber);
  const eventImpact: Partial<EnterpriseMetrics> = {};
  for (const event of appliedEvents) {
    for (const key of Object.keys(event.metricImpact) as Array<keyof EnterpriseMetrics>) {
      eventImpact[key] = (eventImpact[key] ?? 0) + (event.metricImpact[key] ?? 0);
    }
  }

  const hasCrisis = appliedEvents.some((e) => e.kind === "CRISIS");
  const crisisUnmitigated = hasCrisis && allocation.riskMitigation < 0.15;

  const negotiationContribution =
    input.negotiationTrustDeltas.length > 0
      ? (input.negotiationTrustDeltas.reduce((a, b) => a + b, 0) / input.negotiationTrustDeltas.length) *
        SCORING_CONSTANTS.NEGOTIATION_TRUST_WEIGHT
      : 0;

  const technicalDebtIndex = clamp100(
    metricsBefore.technicalDebtIndex -
      allocation.modernization * SCORING_CONSTANTS.DEBT_PAYDOWN_RATE +
      allocation.newFeatures * SCORING_CONSTANTS.DEBT_ACCRUAL_FROM_FEATURES +
      SCORING_CONSTANTS.DEBT_NATURAL_DRIFT +
      nodeDrivenTdiDelta +
      (eventImpact.technicalDebtIndex ?? 0),
  );

  const deliveryVelocity = clamp100(
    metricsBefore.deliveryVelocity +
      allocation.newFeatures * SCORING_CONSTANTS.VELOCITY_GAIN_FROM_FEATURES +
      allocation.modernization * SCORING_CONSTANTS.VELOCITY_GAIN_FROM_MODERNIZATION -
      metricsBefore.technicalDebtIndex * SCORING_CONSTANTS.VELOCITY_DRAG_PER_DEBT_POINT +
      (eventImpact.deliveryVelocity ?? 0),
  );

  const tco = roundTo(
    metricsBefore.tco +
      roundBudget * (1 + metricsBefore.technicalDebtIndex * SCORING_CONSTANTS.TCO_DEBT_PENALTY_PER_POINT) +
      (eventImpact.tco ?? 0),
  );

  const stakeholderTrust = clamp100(
    metricsBefore.stakeholderTrust +
      allocation.stakeholderEngagement * SCORING_CONSTANTS.TRUST_GAIN_FROM_ENGAGEMENT +
      allocation.riskMitigation * SCORING_CONSTANTS.TRUST_GAIN_FROM_RISK_MITIGATION +
      negotiationContribution -
      (crisisUnmitigated ? SCORING_CONSTANTS.TRUST_LOSS_UNMITIGATED_CRISIS : 0) +
      (eventImpact.stakeholderTrust ?? 0),
  );

  return {
    metricsAfter: { tco, technicalDebtIndex, deliveryVelocity, stakeholderTrust },
    topologyAfter,
    appliedEvents,
  };
}

/** TCO normalized to a 0-100 "efficiency" score against a scenario's total budget envelope. */
export function computeTcoEfficiency(tco: number, budgetEnvelope: number): number {
  if (budgetEnvelope <= 0) return 0;
  return clamp100(100 - (tco / budgetEnvelope) * 100);
}

export function computeComposite(metrics: EnterpriseMetrics, budgetEnvelope: number): number {
  const w = SCORING_CONSTANTS.COMPOSITE_WEIGHTS;
  const tcoEfficiency = computeTcoEfficiency(metrics.tco, budgetEnvelope);
  const composite =
    (100 - metrics.technicalDebtIndex) * w.technicalDebtIndex +
    metrics.deliveryVelocity * w.deliveryVelocity +
    metrics.stakeholderTrust * w.stakeholderTrust +
    tcoEfficiency * w.tcoEfficiency;
  return roundTo(composite, 2);
}

export interface WinConditionCheck {
  condition: WinCondition;
  met: boolean;
  actual: number;
}

export function evaluateWinConditions(
  metrics: EnterpriseMetrics,
  conditions: WinCondition[],
  roundNumber: number,
  isFinalRound: boolean,
): WinConditionCheck[] {
  return conditions
    .filter((c) => (c.roundNumber !== undefined ? c.roundNumber === roundNumber : isFinalRound))
    .map((condition) => {
      const actual = metrics[condition.metric];
      const met = condition.comparator === "gte" ? actual >= condition.target : actual <= condition.target;
      return { condition, met, actual };
    });
}

/** Standard budget envelope used for TCO-efficiency normalization: 1.5x nominal total spend. */
export function computeBudgetEnvelope(roundBudget: number, totalRounds: number): number {
  return roundBudget * totalRounds * 1.5;
}
