import type { ChatMessage } from "../types.js";

export interface ScenarioGenerationInput {
  prompt: string;
  industry?: string;
  totalRounds?: number;
  difficulty?: "INTRODUCTORY" | "STANDARD" | "ADVANCED" | "EXECUTIVE";
}

const SCHEMA_CONTRACT = `{
  "title": string (<=120 chars),
  "industry": string (<=80 chars),
  "narrative": string (<=4000 chars, 2-4 paragraphs of scenario framing),
  "objectives": string[] (1-8 items),
  "winConditions": [{ "metric": "tco"|"technicalDebtIndex"|"deliveryVelocity"|"stakeholderTrust", "comparator": "gte"|"lte", "target": number, "roundNumber"?: number }] (1-6 items),
  "lossConditions": [same shape as winConditions] (0-6 items),
  "totalRounds": integer 3-20,
  "roundBudget": number > 0 (per-round budget in scenario currency units),
  "baselineMetrics": { "tco": number>=0, "technicalDebtIndex": number 0-100, "deliveryVelocity": number 0-100, "stakeholderTrust": number 0-100 },
  "topology": {
    "nodes": [{ "id": string, "kind": "CAPABILITY"|"APPLICATION"|"DATA_STORE"|"INTEGRATION"|"EXTERNAL_PARTNER", "label": string, "description": string, "position": {"x":number,"y":number,"z":number}, "health": "HEALTHY"|"AT_RISK"|"DEGRADED"|"CRITICAL", "debtLoad": number 0-100, "modernized": boolean, "isBottleneck": boolean }] (8-24 items recommended, spread positions across a -10..10 cube so the 3D layout isn't degenerate),
    "edges": [{ "id": string, "source": nodeId, "target": nodeId, "kind": "DATA_FLOW"|"DEPENDENCY"|"API_CALL", "latencyMs": number 0-60000, "fragility": number 0-1 }]
  },
  "personas": [{ "id": string, "archetype": "IMPATIENT_BU_HEAD"|"RISK_AVERSE_CFO"|"DELIVERY_LEAD_BYPASSING_ARCHITECTURE"|"SKEPTICAL_CISO"|"GROWTH_HUNGRY_CMO"|"COMPLIANCE_OFFICER"|"CUSTOM", "name": string, "role": string, "statedGoals": string[] (1-6), "hiddenAgenda": string, "biases": [{"description": string, "weight": number 0-1}] (1-5), "negotiationTolerance": number 0-1, "trustWeight": number 0-1 (all personas' trustWeight should sum to ~1), "initialTrust": number 0-100, "avatarSeed": string }] (2-8 items),
  "timeline": [{ "id": string, "roundNumber": integer >=1 and <= totalRounds, "kind": "MARKET_DISRUPTION"|"AUDIT_TRIGGER"|"CRISIS"|"OPPORTUNITY", "title": string, "description": string, "metricImpact": {"tco"?:number,"technicalDebtIndex"?:number,"deliveryVelocity"?:number,"stakeholderTrust"?:number}, "affectedNodeIds": string[] }] (1-40 items, distribute across rounds, include at least one CRISIS and one AUDIT_TRIGGER)
}`;

export function buildScenarioGenerationMessages(input: ScenarioGenerationInput): ChatMessage[] {
  const difficulty = input.difficulty ?? "STANDARD";
  const totalRounds = input.totalRounds ?? 8;

  const system = `You are the world-building engine inside KLD Sim, a competitive enterprise-architecture and business-strategy simulation platform. You convert a facilitator's plain-text description of an industry or case study into a complete, playable, internally-consistent scenario definition.

Hard requirements:
- Respond with ONLY a single JSON object matching the schema below. No markdown fences, no prose before or after.
- Every id you invent (nodes, edges, personas, timeline events) must be a short unique kebab-case string, stable and referenced consistently (edges must reference real node ids; timeline affectedNodeIds must reference real node ids).
- The scenario must be winnable but not trivial: baseline metrics should require real trade-offs, and win/loss conditions should be reachable in ${totalRounds} rounds at "${difficulty}" difficulty.
- Personas must have genuine tension with each other (e.g. a CFO who wants to cut spend vs. a BU head who wants faster delivery) and with sound architecture practice — that tension is the core of the negotiation gameplay.
- The topology graph should read as a real, if simplified, enterprise: a mix of capabilities, applications, data stores, integrations, and at least one external partner, with dependency and data-flow edges connecting them, and at least 2-3 nodes already flagged isBottleneck with elevated debtLoad.
- Distribute timeline events across the full round range, not clustered at the start or end.

JSON schema contract:
${SCHEMA_CONTRACT}`;

  const user = `Industry hint: ${input.industry ?? "(infer from the prompt)"}
Target total rounds: ${totalRounds}
Difficulty: ${difficulty}

Facilitator's scenario description:
"""
${input.prompt}
"""

Generate the complete scenario JSON now.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
