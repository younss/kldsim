import { describe, it, expect } from "vitest";
import {
  resolveRound,
  validateAllocation,
  InvalidAllocationError,
  computeComposite,
  computeBudgetEnvelope,
  evaluateWinConditions,
  applyNodeActions,
} from "./engine.js";
import { BASELINE_METRICS } from "../types/enterprise.js";
import type { TopologyGraph } from "../types/topology.js";
import type { TimelineEvent } from "../types/scenario.js";

function makeTopology(count: number, debtLoad = 50): TopologyGraph {
  return {
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`,
      kind: "APPLICATION" as const,
      label: `Node ${i}`,
      description: "",
      position: { x: i, y: 0, z: 0 },
      health: "AT_RISK" as const,
      debtLoad,
      modernized: false,
      isBottleneck: false,
    })),
    edges: [],
  };
}

describe("validateAllocation", () => {
  it("accepts an allocation that sums to 1", () => {
    expect(() =>
      validateAllocation({ modernization: 0.25, newFeatures: 0.25, riskMitigation: 0.25, stakeholderEngagement: 0.25 }),
    ).not.toThrow();
  });

  it("rejects an allocation that does not sum to 1", () => {
    expect(() =>
      validateAllocation({ modernization: 0.5, newFeatures: 0.5, riskMitigation: 0.5, stakeholderEngagement: 0.5 }),
    ).toThrow(InvalidAllocationError);
  });

  it("rejects negative fractions", () => {
    expect(() =>
      validateAllocation({ modernization: -0.1, newFeatures: 0.4, riskMitigation: 0.4, stakeholderEngagement: 0.3 }),
    ).toThrow(InvalidAllocationError);
  });
});

describe("resolveRound", () => {
  const topology = makeTopology(4, 50);

  it("is a pure function: identical input always produces identical output", () => {
    const input = {
      metricsBefore: BASELINE_METRICS,
      topologyBefore: topology,
      allocation: { modernization: 0.4, newFeatures: 0.3, riskMitigation: 0.2, stakeholderEngagement: 0.1 },
      nodeActions: [{ nodeId: "node-0", action: "MODERNIZE" as const }],
      roundBudget: 1_000_000,
      roundNumber: 1,
      timelineEvents: [],
      negotiationTrustDeltas: [],
    };
    const a = resolveRound(input);
    const b = resolveRound(input);
    expect(a).toEqual(b);
  });

  it("heavy modernization spend reduces technicalDebtIndex vs. heavy feature spend", () => {
    const base = {
      metricsBefore: BASELINE_METRICS,
      topologyBefore: topology,
      nodeActions: [],
      roundBudget: 1_000_000,
      roundNumber: 1,
      timelineEvents: [],
      negotiationTrustDeltas: [],
    };
    const modernizing = resolveRound({
      ...base,
      allocation: { modernization: 0.7, newFeatures: 0.1, riskMitigation: 0.1, stakeholderEngagement: 0.1 },
    });
    const featureHeavy = resolveRound({
      ...base,
      allocation: { modernization: 0.1, newFeatures: 0.7, riskMitigation: 0.1, stakeholderEngagement: 0.1 },
    });
    expect(modernizing.metricsAfter.technicalDebtIndex).toBeLessThan(featureHeavy.metricsAfter.technicalDebtIndex);
    expect(featureHeavy.metricsAfter.deliveryVelocity).toBeGreaterThan(modernizing.metricsAfter.deliveryVelocity);
  });

  it("higher technicalDebtIndex increases TCO for an identical budget", () => {
    const lowDebt = resolveRound({
      metricsBefore: { ...BASELINE_METRICS, technicalDebtIndex: 10 },
      topologyBefore: topology,
      allocation: { modernization: 0.25, newFeatures: 0.25, riskMitigation: 0.25, stakeholderEngagement: 0.25 },
      nodeActions: [],
      roundBudget: 1_000_000,
      roundNumber: 1,
      timelineEvents: [],
      negotiationTrustDeltas: [],
    });
    const highDebt = resolveRound({
      metricsBefore: { ...BASELINE_METRICS, technicalDebtIndex: 90 },
      topologyBefore: topology,
      allocation: { modernization: 0.25, newFeatures: 0.25, riskMitigation: 0.25, stakeholderEngagement: 0.25 },
      nodeActions: [],
      roundBudget: 1_000_000,
      roundNumber: 1,
      timelineEvents: [],
      negotiationTrustDeltas: [],
    });
    expect(highDebt.metricsAfter.tco).toBeGreaterThan(lowDebt.metricsAfter.tco);
  });

  it("an unmitigated CRISIS event costs stakeholder trust", () => {
    const crisisEvent: TimelineEvent = {
      id: "evt-1",
      roundNumber: 2,
      kind: "CRISIS",
      title: "Vendor outage",
      description: "A key SaaS vendor suffers a multi-day outage.",
      metricImpact: {},
      affectedNodeIds: [],
    };
    const withoutMitigation = resolveRound({
      metricsBefore: BASELINE_METRICS,
      topologyBefore: topology,
      allocation: { modernization: 0.4, newFeatures: 0.4, riskMitigation: 0.05, stakeholderEngagement: 0.15 },
      nodeActions: [],
      roundBudget: 1_000_000,
      roundNumber: 2,
      timelineEvents: [crisisEvent],
      negotiationTrustDeltas: [],
    });
    const withMitigation = resolveRound({
      metricsBefore: BASELINE_METRICS,
      topologyBefore: topology,
      allocation: { modernization: 0.3, newFeatures: 0.3, riskMitigation: 0.3, stakeholderEngagement: 0.1 },
      nodeActions: [],
      roundBudget: 1_000_000,
      roundNumber: 2,
      timelineEvents: [crisisEvent],
      negotiationTrustDeltas: [],
    });
    expect(withoutMitigation.metricsAfter.stakeholderTrust).toBeLessThan(withMitigation.metricsAfter.stakeholderTrust);
  });

  it("clamps all normalized metrics to [0, 100]", () => {
    const result = resolveRound({
      metricsBefore: { tco: 0, technicalDebtIndex: 2, deliveryVelocity: 99, stakeholderTrust: 99 },
      topologyBefore: topology,
      allocation: { modernization: 0, newFeatures: 1, riskMitigation: 0, stakeholderEngagement: 0 },
      nodeActions: [],
      roundBudget: 1_000_000,
      roundNumber: 1,
      timelineEvents: [],
      negotiationTrustDeltas: [100, 100, 100],
    });
    expect(result.metricsAfter.deliveryVelocity).toBeLessThanOrEqual(100);
    expect(result.metricsAfter.stakeholderTrust).toBeLessThanOrEqual(100);
    expect(result.metricsAfter.technicalDebtIndex).toBeGreaterThanOrEqual(0);
  });
});

describe("applyNodeActions", () => {
  it("MODERNIZE reduces a node's debt and marks it modernized", () => {
    const topology = makeTopology(2, 80);
    const { topology: after } = applyNodeActions(topology, [{ nodeId: "node-0", action: "MODERNIZE" }]);
    expect(after.nodes[0]!.debtLoad).toBeLessThan(80);
    expect(after.nodes[0]!.modernized).toBe(true);
  });

  it("nodes with no action drift upward slightly (organizational entropy)", () => {
    const topology = makeTopology(1, 30);
    const { topology: after } = applyNodeActions(topology, []);
    expect(after.nodes[0]!.debtLoad).toBeGreaterThan(30);
  });

  it("IGNORE drifts debt up faster than an untouched node", () => {
    const topology = makeTopology(2, 30);
    const { topology: after } = applyNodeActions(topology, [{ nodeId: "node-0", action: "IGNORE" }]);
    const ignored = after.nodes.find((n) => n.id === "node-0")!;
    const untouched = after.nodes.find((n) => n.id === "node-1")!;
    expect(ignored.debtLoad).toBeGreaterThan(untouched.debtLoad);
  });
});

describe("computeComposite", () => {
  it("scores a healthy enterprise higher than a distressed one", () => {
    const envelope = computeBudgetEnvelope(1_000_000, 8);
    const healthy = computeComposite({ tco: 2_000_000, technicalDebtIndex: 15, deliveryVelocity: 85, stakeholderTrust: 90 }, envelope);
    const distressed = computeComposite({ tco: 10_000_000, technicalDebtIndex: 85, deliveryVelocity: 20, stakeholderTrust: 25 }, envelope);
    expect(healthy).toBeGreaterThan(distressed);
  });
});

describe("evaluateWinConditions", () => {
  it("evaluates final-round conditions only when isFinalRound is true", () => {
    const conditions = [{ metric: "deliveryVelocity" as const, comparator: "gte" as const, target: 70 }];
    const metrics = { ...BASELINE_METRICS, deliveryVelocity: 75 };
    expect(evaluateWinConditions(metrics, conditions, 3, false)).toHaveLength(0);
    const results = evaluateWinConditions(metrics, conditions, 8, true);
    expect(results).toHaveLength(1);
    expect(results[0]!.met).toBe(true);
  });
});
