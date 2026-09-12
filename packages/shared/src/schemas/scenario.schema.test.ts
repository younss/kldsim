import { describe, it, expect } from "vitest";
import { generatedScenarioSchema } from "./scenario.schema.js";

function baseScenario() {
  return {
    title: "Test Scenario",
    industry: "Manufacturing",
    narrative: "A test narrative long enough to pass validation.",
    objectives: ["Reduce debt"],
    winConditions: [{ metric: "deliveryVelocity", comparator: "gte", target: 70 }],
    lossConditions: [{ metric: "stakeholderTrust", comparator: "lte", target: 10 }],
    totalRounds: 5,
    roundBudget: 100_000,
    baselineMetrics: { tco: 0, technicalDebtIndex: 40, deliveryVelocity: 50, stakeholderTrust: 60 },
    topology: {
      nodes: [
        { id: "n1", kind: "APPLICATION", label: "App 1", description: "desc", position: { x: 0, y: 0, z: 0 }, health: "HEALTHY", debtLoad: 10, modernized: false, isBottleneck: false },
        { id: "n2", kind: "APPLICATION", label: "App 2", description: "desc", position: { x: 1, y: 0, z: 0 }, health: "HEALTHY", debtLoad: 10, modernized: false, isBottleneck: false },
        { id: "n3", kind: "DATA_STORE", label: "DB", description: "desc", position: { x: 2, y: 0, z: 0 }, health: "HEALTHY", debtLoad: 10, modernized: false, isBottleneck: false },
        { id: "n4", kind: "INTEGRATION", label: "Bridge", description: "desc", position: { x: 3, y: 0, z: 0 }, health: "HEALTHY", debtLoad: 10, modernized: false, isBottleneck: false },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2", kind: "API_CALL", latencyMs: 100, fragility: 0.2 }],
    },
    personas: [
      { id: "p1", archetype: "RISK_AVERSE_CFO", name: "A", role: "CFO", statedGoals: ["g"], hiddenAgenda: "h", biases: [{ description: "b", weight: 0.5 }], negotiationTolerance: 0.5, trustWeight: 0.5, initialTrust: 50, avatarSeed: "a" },
      { id: "p2", archetype: "IMPATIENT_BU_HEAD", name: "B", role: "BU Head", statedGoals: ["g"], hiddenAgenda: "h", biases: [{ description: "b", weight: 0.5 }], negotiationTolerance: 0.5, trustWeight: 0.5, initialTrust: 50, avatarSeed: "b" },
    ],
    timeline: [{ id: "t1", roundNumber: 2, kind: "CRISIS", title: "Crisis", description: "desc", metricImpact: { stakeholderTrust: -5 }, affectedNodeIds: ["n1"] }],
  };
}

describe("generatedScenarioSchema referential integrity", () => {
  it("accepts an internally-consistent scenario", () => {
    const result = generatedScenarioSchema.safeParse(baseScenario());
    expect(result.success).toBe(true);
  });

  it("rejects an edge pointing at a non-existent node", () => {
    const scenario = baseScenario();
    scenario.topology.edges.push({ id: "e2", source: "n1", target: "ghost-node", kind: "API_CALL", latencyMs: 50, fragility: 0.1 });
    const result = generatedScenarioSchema.safeParse(scenario);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("ghost-node"))).toBe(true);
    }
  });

  it("rejects a timeline event scheduled beyond totalRounds", () => {
    const scenario = baseScenario();
    scenario.timeline.push({ id: "t2", roundNumber: 99, kind: "OPPORTUNITY", title: "Late", description: "desc", metricImpact: { stakeholderTrust: 0 }, affectedNodeIds: [] });
    const result = generatedScenarioSchema.safeParse(scenario);
    expect(result.success).toBe(false);
  });

  it("rejects persona trustWeight values that don't sum to ~1", () => {
    const scenario = baseScenario();
    scenario.personas[0]!.trustWeight = 0.1;
    scenario.personas[1]!.trustWeight = 0.1;
    const result = generatedScenarioSchema.safeParse(scenario);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("trustWeight"))).toBe(true);
    }
  });

  it("rejects duplicate node ids", () => {
    const scenario = baseScenario();
    scenario.topology.nodes[1]!.id = "n1";
    const result = generatedScenarioSchema.safeParse(scenario);
    expect(result.success).toBe(false);
  });
});
