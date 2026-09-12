import { z } from "zod";
import { LLMProviderKind } from "../types/common.js";

/**
 * Zod mirror of the GeneratedScenarioPayload type. This is the contract the
 * LLM gateway's structured-output guard validates every Game Studio
 * generation against before it is ever shown to a facilitator or persisted.
 * Keep this in lockstep with packages/shared/src/types/scenario.ts.
 */

export const enterpriseMetricsSchema = z.object({
  tco: z.number().min(0),
  technicalDebtIndex: z.number().min(0).max(100),
  deliveryVelocity: z.number().min(0).max(100),
  stakeholderTrust: z.number().min(0).max(100),
});

/**
 * Deltas (timeline event impacts), unlike absolute metrics, are signed —
 * a crisis should be able to *subtract* stakeholderTrust. Deliberately a
 * separate schema from enterpriseMetricsSchema rather than `.partial()` of
 * it, since partial() only makes keys optional and would otherwise silently
 * inherit the absolute-value min(0) floor onto what must be a signed delta.
 */
export const metricImpactSchema = z.object({
  tco: z.number().min(-10_000_000).max(10_000_000).optional(),
  technicalDebtIndex: z.number().min(-100).max(100).optional(),
  deliveryVelocity: z.number().min(-100).max(100).optional(),
  stakeholderTrust: z.number().min(-100).max(100).optional(),
});

export const winConditionSchema = z.object({
  metric: z.enum(["tco", "technicalDebtIndex", "deliveryVelocity", "stakeholderTrust"]),
  comparator: z.enum(["gte", "lte"]),
  target: z.number(),
  roundNumber: z.number().int().positive().optional(),
});

export const topologyNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["CAPABILITY", "APPLICATION", "DATA_STORE", "INTEGRATION", "EXTERNAL_PARTNER"]),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  health: z.enum(["HEALTHY", "AT_RISK", "DEGRADED", "CRITICAL"]),
  debtLoad: z.number().min(0).max(100),
  modernized: z.boolean(),
  isBottleneck: z.boolean(),
});

export const topologyEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["DATA_FLOW", "DEPENDENCY", "API_CALL"]),
  latencyMs: z.number().min(0).max(60_000),
  fragility: z.number().min(0).max(1),
});

export const topologyGraphSchema = z.object({
  nodes: z.array(topologyNodeSchema).min(4).max(60),
  edges: z.array(topologyEdgeSchema).max(200),
});

export const personaBiasSchema = z.object({
  description: z.string().min(1).max(300),
  weight: z.number().min(0).max(1),
});

export const stakeholderPersonaSchema = z.object({
  id: z.string().min(1),
  archetype: z.enum([
    "IMPATIENT_BU_HEAD",
    "RISK_AVERSE_CFO",
    "DELIVERY_LEAD_BYPASSING_ARCHITECTURE",
    "SKEPTICAL_CISO",
    "GROWTH_HUNGRY_CMO",
    "COMPLIANCE_OFFICER",
    "CUSTOM",
  ]),
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(120),
  statedGoals: z.array(z.string().min(1).max(200)).min(1).max(6),
  hiddenAgenda: z.string().min(1).max(500),
  biases: z.array(personaBiasSchema).min(1).max(5),
  negotiationTolerance: z.number().min(0).max(1),
  trustWeight: z.number().min(0).max(1),
  initialTrust: z.number().min(0).max(100),
  avatarSeed: z.string().min(1).max(40),
});

export const timelineEventSchema = z.object({
  id: z.string().min(1),
  roundNumber: z.number().int().positive(),
  kind: z.enum(["MARKET_DISRUPTION", "AUDIT_TRIGGER", "CRISIS", "OPPORTUNITY"]),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  metricImpact: metricImpactSchema,
  affectedNodeIds: z.array(z.string().min(1)).max(20),
});

export const generatedScenarioSchema = z.object({
  title: z.string().min(1).max(120),
  industry: z.string().min(1).max(80),
  narrative: z.string().min(1).max(4000),
  objectives: z.array(z.string().min(1).max(200)).min(1).max(8),
  winConditions: z.array(winConditionSchema).min(1).max(6),
  lossConditions: z.array(winConditionSchema).min(0).max(6),
  totalRounds: z.number().int().min(3).max(20),
  roundBudget: z.number().positive(),
  baselineMetrics: enterpriseMetricsSchema,
  topology: topologyGraphSchema,
  personas: z.array(stakeholderPersonaSchema).min(2).max(8),
  timeline: z.array(timelineEventSchema).min(1).max(40),
}).superRefine((scenario, ctx) => {
  // Cross-field referential integrity the base shape can't express alone.
  // These run as part of the same zod validation the LLM gateway's repair
  // loop reacts to, so a generation with dangling references is fed back to
  // the model as a normal validation failure instead of silently corrupting data.
  const nodeIds = new Set(scenario.topology.nodes.map((n) => n.id));
  if (nodeIds.size !== scenario.topology.nodes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "topology.nodes ids must be unique", path: ["topology", "nodes"] });
  }

  scenario.topology.edges.forEach((edge, i) => {
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `edge.source "${edge.source}" does not reference an existing node id`, path: ["topology", "edges", i, "source"] });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `edge.target "${edge.target}" does not reference an existing node id`, path: ["topology", "edges", i, "target"] });
    }
  });

  scenario.timeline.forEach((event, i) => {
    if (event.roundNumber > scenario.totalRounds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `timeline[${i}].roundNumber (${event.roundNumber}) exceeds totalRounds (${scenario.totalRounds})`, path: ["timeline", i, "roundNumber"] });
    }
    event.affectedNodeIds.forEach((nodeId, j) => {
      if (!nodeIds.has(nodeId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `timeline[${i}].affectedNodeIds[${j}] "${nodeId}" does not reference an existing node id`, path: ["timeline", i, "affectedNodeIds", j] });
      }
    });
  });

  [...scenario.winConditions, ...scenario.lossConditions].forEach((condition, i) => {
    if (condition.roundNumber !== undefined && condition.roundNumber > scenario.totalRounds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `condition[${i}].roundNumber (${condition.roundNumber}) exceeds totalRounds (${scenario.totalRounds})`, path: ["winConditions", i, "roundNumber"] });
    }
  });

  const personaIds = new Set(scenario.personas.map((p) => p.id));
  if (personaIds.size !== scenario.personas.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "personas ids must be unique", path: ["personas"] });
  }

  const trustWeightSum = scenario.personas.reduce((sum, p) => sum + p.trustWeight, 0);
  if (Math.abs(trustWeightSum - 1) > 0.05) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `personas[].trustWeight must sum to ~1.0 across all personas, got ${trustWeightSum.toFixed(2)}`, path: ["personas"] });
  }
});

export type GeneratedScenarioSchemaType = z.infer<typeof generatedScenarioSchema>;

export const scenarioAuthoringRequestSchema = z.object({
  prompt: z.string().min(20, "Describe the scenario in more detail (min 20 characters)").max(4000),
  industry: z.string().max(80).optional(),
  totalRounds: z.number().int().min(3).max(20).optional(),
  difficulty: z.enum(["INTRODUCTORY", "STANDARD", "ADVANCED", "EXECUTIVE"]).optional(),
  providerOverride: z.nativeEnum(LLMProviderKind).optional(),
});

export type ScenarioAuthoringRequest = z.infer<typeof scenarioAuthoringRequestSchema>;
