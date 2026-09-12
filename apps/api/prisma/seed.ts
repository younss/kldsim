import bcrypt from "bcryptjs";
import { PrismaClient, PlatformRole, ScenarioStatus, SessionStatus, LLMProviderKind } from "../generated/prisma/index.js";
import type { TopologyGraph, StakeholderPersona, TimelineEvent, EnterpriseMetrics, WinCondition } from "@kldsim/shared";

// Deliberately self-contained: this script must run identically via `tsx` in
// local dev (against apps/api/src) and inside the production container
// (which only ships apps/api/dist + apps/api/prisma, no src/) — so it never
// imports from ../src and re-implements the two things it needs directly.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || "gemma3:4b";
function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

const prisma = new PrismaClient();
const DEMO_PASSWORD = "ChangeMe123!";

const topology: TopologyGraph = {
  nodes: [
    { id: "core-banking", kind: "APPLICATION", label: "Core Banking Ledger", description: "30-year-old COBOL ledger of record.", position: { x: -6, y: 0, z: 0 }, health: "CRITICAL", debtLoad: 82, modernized: false, isBottleneck: true },
    { id: "legacy-mainframe-adapter", kind: "INTEGRATION", label: "Mainframe Adapter", description: "Brittle batch-file bridge to the mainframe.", position: { x: -3, y: 1, z: 2 }, health: "CRITICAL", debtLoad: 78, modernized: false, isBottleneck: true },
    { id: "payments-gateway", kind: "APPLICATION", label: "Payments Gateway", description: "Real-time payments processing.", position: { x: 0, y: 0, z: 0 }, health: "DEGRADED", debtLoad: 58, modernized: false, isBottleneck: false },
    { id: "fraud-detection", kind: "CAPABILITY", label: "Fraud Detection", description: "Rules-based fraud scoring capability.", position: { x: 2, y: 2, z: -2 }, health: "AT_RISK", debtLoad: 40, modernized: false, isBottleneck: false },
    { id: "customer-portal", kind: "APPLICATION", label: "Customer Web Portal", description: "Public-facing online banking portal.", position: { x: 4, y: -1, z: 1 }, health: "AT_RISK", debtLoad: 35, modernized: false, isBottleneck: false },
    { id: "mobile-app", kind: "APPLICATION", label: "Mobile Banking App", description: "iOS/Android banking client.", position: { x: 6, y: 0, z: 3 }, health: "HEALTHY", debtLoad: 20, modernized: false, isBottleneck: false },
    { id: "crm", kind: "APPLICATION", label: "CRM", description: "Sales and support customer records.", position: { x: 3, y: -3, z: -1 }, health: "AT_RISK", debtLoad: 42, modernized: false, isBottleneck: false },
    { id: "data-warehouse", kind: "DATA_STORE", label: "Enterprise Data Warehouse", description: "Nightly-batch analytics store.", position: { x: -2, y: -2, z: -3 }, health: "DEGRADED", debtLoad: 55, modernized: false, isBottleneck: false },
    { id: "identity-provider", kind: "CAPABILITY", label: "Identity & Access", description: "Authentication and authorization service.", position: { x: 1, y: 3, z: 1 }, health: "HEALTHY", debtLoad: 18, modernized: false, isBottleneck: false },
    { id: "partner-api-gateway", kind: "EXTERNAL_PARTNER", label: "Open Banking Partner API", description: "Regulatory open-banking API surface for third parties.", position: { x: 5, y: 2, z: -3 }, health: "AT_RISK", debtLoad: 38, modernized: false, isBottleneck: false },
  ],
  edges: [
    { id: "e1", source: "core-banking", target: "legacy-mainframe-adapter", kind: "DEPENDENCY", latencyMs: 800, fragility: 0.7 },
    { id: "e2", source: "legacy-mainframe-adapter", target: "payments-gateway", kind: "DATA_FLOW", latencyMs: 450, fragility: 0.6 },
    { id: "e3", source: "payments-gateway", target: "fraud-detection", kind: "API_CALL", latencyMs: 120, fragility: 0.3 },
    { id: "e4", source: "payments-gateway", target: "customer-portal", kind: "API_CALL", latencyMs: 90, fragility: 0.25 },
    { id: "e5", source: "customer-portal", target: "identity-provider", kind: "API_CALL", latencyMs: 60, fragility: 0.1 },
    { id: "e6", source: "mobile-app", target: "identity-provider", kind: "API_CALL", latencyMs: 60, fragility: 0.1 },
    { id: "e7", source: "mobile-app", target: "payments-gateway", kind: "API_CALL", latencyMs: 100, fragility: 0.3 },
    { id: "e8", source: "crm", target: "data-warehouse", kind: "DATA_FLOW", latencyMs: 500, fragility: 0.4 },
    { id: "e9", source: "core-banking", target: "data-warehouse", kind: "DATA_FLOW", latencyMs: 900, fragility: 0.65 },
    { id: "e10", source: "partner-api-gateway", target: "payments-gateway", kind: "API_CALL", latencyMs: 150, fragility: 0.35 },
    { id: "e11", source: "crm", target: "customer-portal", kind: "DATA_FLOW", latencyMs: 200, fragility: 0.3 },
  ],
};

const personas: StakeholderPersona[] = [
  {
    id: "cfo-morgan",
    archetype: "RISK_AVERSE_CFO",
    name: "Morgan Ellery",
    role: "Chief Financial Officer",
    statedGoals: ["Keep run-cost predictable quarter over quarter", "Avoid any regulatory fines", "See ROI evidence before approving large modernization spend"],
    hiddenAgenda: "Is quietly under pressure from the board to cut IT opex by 15% this year and will resist any proposal that raises near-term TCO, even if it reduces long-term risk.",
    biases: [
      { description: "Discounts long-term technical-debt risk in favor of this quarter's numbers", weight: 0.7 },
      { description: "Trusts numbers over narrative — unpersuaded by qualitative risk arguments", weight: 0.5 },
    ],
    negotiationTolerance: 0.4,
    trustWeight: 0.4,
    initialTrust: 55,
    avatarSeed: "morgan-ellery",
  },
  {
    id: "bu-head-priya",
    archetype: "IMPATIENT_BU_HEAD",
    name: "Priya Nandakumar",
    role: "Head of Retail Banking",
    statedGoals: ["Ship the new mobile features competitors already have", "Grow digital account openings 20% this year"],
    hiddenAgenda: "Her annual bonus is tied to feature-launch velocity, not platform health, so she will push the team to defer modernization work indefinitely.",
    biases: [
      { description: "Sees architecture work as pure overhead with no visible customer benefit", weight: 0.6 },
      { description: "Overweights competitor feature comparisons in every discussion", weight: 0.4 },
    ],
    negotiationTolerance: 0.5,
    trustWeight: 0.3,
    initialTrust: 60,
    avatarSeed: "priya-nandakumar",
  },
  {
    id: "delivery-lead-tomas",
    archetype: "DELIVERY_LEAD_BYPASSING_ARCHITECTURE",
    name: "Tomas Reyes",
    role: "Engineering Delivery Lead",
    statedGoals: ["Hit every sprint commitment", "Keep the backlog burn-down looking healthy for leadership reviews"],
    hiddenAgenda: "Has been quietly approving direct database writes that bypass the core-banking ledger's API to hit deadlines, and does not want that surfaced.",
    biases: [
      { description: "Downplays architectural shortcuts as 'temporary' even when they've persisted for years", weight: 0.65 },
      { description: "Reacts defensively to any audit or governance-process proposal", weight: 0.5 },
    ],
    negotiationTolerance: 0.3,
    trustWeight: 0.3,
    initialTrust: 50,
    avatarSeed: "tomas-reyes",
  },
];

const timeline: TimelineEvent[] = [
  { id: "t1", roundNumber: 1, kind: "MARKET_DISRUPTION", title: "Fintech Challenger Launches Instant Onboarding", description: "A neobank competitor launches 90-second account opening, pressuring the digital roadmap.", metricImpact: { stakeholderTrust: -4 }, affectedNodeIds: ["customer-portal", "mobile-app"] },
  { id: "t2", roundNumber: 2, kind: "AUDIT_TRIGGER", title: "Regulatory IT Risk Audit Announced", description: "The banking regulator schedules a technology risk audit for the core ledger and payments path.", metricImpact: { technicalDebtIndex: 3 }, affectedNodeIds: ["core-banking", "legacy-mainframe-adapter"] },
  { id: "t3", roundNumber: 3, kind: "CRISIS", title: "Mainframe Adapter Outage", description: "A batch-file corruption in the mainframe adapter causes a four-hour payments delay.", metricImpact: { stakeholderTrust: -10, deliveryVelocity: -6 }, affectedNodeIds: ["legacy-mainframe-adapter", "payments-gateway"] },
  { id: "t4", roundNumber: 4, kind: "OPPORTUNITY", title: "Open Banking Partnership Offer", description: "A fintech aggregator offers a lucrative integration deal if the partner API can meet new throughput SLAs.", metricImpact: { deliveryVelocity: 4 }, affectedNodeIds: ["partner-api-gateway"] },
  { id: "t5", roundNumber: 5, kind: "AUDIT_TRIGGER", title: "Data Warehouse Compliance Review", description: "Internal audit flags stale customer data retention in the warehouse.", metricImpact: { technicalDebtIndex: 2 }, affectedNodeIds: ["data-warehouse"] },
  { id: "t6", roundNumber: 6, kind: "CRISIS", title: "Fraud Ring Exploits Legacy Gap", description: "A coordinated fraud ring exploits a gap between the fraud-detection rules and the bypassed ledger writes.", metricImpact: { stakeholderTrust: -12, tco: 150000 }, affectedNodeIds: ["fraud-detection", "core-banking"] },
];

const baselineMetrics: EnterpriseMetrics = { tco: 0, technicalDebtIndex: 52, deliveryVelocity: 48, stakeholderTrust: 58 };

const winConditions: WinCondition[] = [
  { metric: "deliveryVelocity", comparator: "gte", target: 72 },
  { metric: "technicalDebtIndex", comparator: "lte", target: 32 },
  { metric: "stakeholderTrust", comparator: "gte", target: 68 },
];

const lossConditions: WinCondition[] = [{ metric: "stakeholderTrust", comparator: "lte", target: 8 }];

async function main() {
  console.log("Seeding KLD Sim demo data...");

  const tenant = await prisma.tenant.create({ data: { name: "KLD Sim Demo Bank" } });
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [admin, facilitator, player1, player2, player3, player4] = await Promise.all([
    prisma.user.create({ data: { tenantId: tenant.id, email: "admin@kldsim.local", displayName: "Alex Admin", role: PlatformRole.PLATFORM_ADMIN, passwordHash } }),
    prisma.user.create({ data: { tenantId: tenant.id, email: "facilitator@kldsim.local", displayName: "Fiona Facilitator", role: PlatformRole.FACILITATOR, passwordHash } }),
    prisma.user.create({ data: { tenantId: tenant.id, email: "player1@kldsim.local", displayName: "Player One", role: PlatformRole.PLAYER, passwordHash } }),
    prisma.user.create({ data: { tenantId: tenant.id, email: "player2@kldsim.local", displayName: "Player Two", role: PlatformRole.PLAYER, passwordHash } }),
    prisma.user.create({ data: { tenantId: tenant.id, email: "player3@kldsim.local", displayName: "Player Three", role: PlatformRole.PLAYER, passwordHash } }),
    prisma.user.create({ data: { tenantId: tenant.id, email: "player4@kldsim.local", displayName: "Player Four", role: PlatformRole.PLAYER, passwordHash } }),
  ]);

  await prisma.providerConfig.create({
    data: {
      tenantId: tenant.id,
      provider: LLMProviderKind.OLLAMA,
      model: OLLAMA_DEFAULT_MODEL,
      baseUrl: OLLAMA_BASE_URL,
      isDefault: true,
      enabled: true,
    },
  });

  const scenario = await prisma.scenario.create({
    data: {
      tenantId: tenant.id,
      status: ScenarioStatus.PUBLISHED,
      title: "Legacy Bank Modernization",
      industry: "Retail Banking",
      narrative:
        "Meridian Trust is a 40-year-old regional bank whose core ledger still runs on a mainframe from the 1990s. Digital-native competitors are eating into deposits with instant onboarding and slick mobile experiences, while the board wants both aggressive digital growth and airtight regulatory compliance — on a flat budget. Your team now runs technology strategy for Meridian Trust: balance modernization, delivery speed, risk, and the trust of a CFO, a growth-hungry business unit head, and a delivery lead who has been cutting corners.",
      authoringPrompt: "(seeded demo scenario — hand-authored, not LLM-generated)",
      objectives: [
        "Reduce technical debt on the core banking and payments path without stalling feature delivery",
        "Win back stakeholder trust after early market and audit pressure",
        "Keep cumulative spend within a sustainable envelope",
      ],
      winConditions,
      lossConditions,
      totalRounds: 6,
      roundBudget: 500_000,
      baselineMetrics,
      topology,
      personas,
      timeline,
      createdBy: admin.id,
    },
  });

  const session = await prisma.gameSession.create({
    data: {
      tenantId: tenant.id,
      scenarioId: scenario.id,
      facilitatorId: facilitator.id,
      status: SessionStatus.LOBBY,
      roundDurationSeconds: 900,
    },
  });

  await prisma.team.create({
    data: {
      sessionId: session.id,
      name: "Team Falcon",
      metrics: baselineMetrics,
      topology,
      members: { create: [{ userId: player1.id }, { userId: player2.id }] },
    },
  });

  await prisma.team.create({
    data: {
      sessionId: session.id,
      name: "Team Phoenix",
      metrics: baselineMetrics,
      topology,
      members: { create: [{ userId: player3.id }, { userId: player4.id }] },
    },
  });

  console.log("\nSeed complete.");
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Demo session id: ${session.id}`);
  console.log(`\nDemo accounts (password for all: ${DEMO_PASSWORD}):`);
  console.log("  admin@kldsim.local        PLATFORM_ADMIN");
  console.log("  facilitator@kldsim.local  FACILITATOR");
  console.log("  player1@kldsim.local      PLAYER (Team Falcon)");
  console.log("  player2@kldsim.local      PLAYER (Team Falcon)");
  console.log("  player3@kldsim.local      PLAYER (Team Phoenix)");
  console.log("  player4@kldsim.local      PLAYER (Team Phoenix)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
