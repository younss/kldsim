import { ScenarioStatus } from "../../../generated/prisma/index.js";
import type { GeneratedScenarioSchemaType } from "@kldsim/shared";
import { generatedScenarioSchema } from "@kldsim/shared";
import { prisma } from "../../db.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors.js";
import { toJson } from "../../lib/json.js";

export function listScenarios(tenantId: string, status?: ScenarioStatus) {
  return prisma.scenario.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getScenario(tenantId: string, id: string) {
  const scenario = await prisma.scenario.findFirst({ where: { id, tenantId } });
  if (!scenario) throw new NotFoundError("Scenario not found");
  return scenario;
}

export async function createDraftScenario(tenantId: string, createdBy: string, authoringPrompt: string, generated: GeneratedScenarioSchemaType) {
  return prisma.scenario.create({
    data: {
      tenantId,
      createdBy,
      authoringPrompt,
      status: ScenarioStatus.DRAFT,
      title: generated.title,
      industry: generated.industry,
      narrative: generated.narrative,
      objectives: generated.objectives,
      winConditions: generated.winConditions,
      lossConditions: generated.lossConditions,
      totalRounds: generated.totalRounds,
      roundBudget: generated.roundBudget,
      baselineMetrics: generated.baselineMetrics,
      topology: generated.topology,
      personas: generated.personas,
      timeline: generated.timeline,
    },
  });
}

export interface ScenarioEditableFields {
  title?: string;
  industry?: string;
  narrative?: string;
  objectives?: string[];
  winConditions?: unknown;
  lossConditions?: unknown;
  totalRounds?: number;
  roundBudget?: number;
  baselineMetrics?: unknown;
  topology?: unknown;
  personas?: unknown;
  timeline?: unknown;
}

export async function updateScenario(tenantId: string, id: string, patch: ScenarioEditableFields) {
  const scenario = await getScenario(tenantId, id);
  if (scenario.status === ScenarioStatus.PUBLISHED) {
    throw new ForbiddenError("Published scenarios are immutable — archive and duplicate instead of editing in place");
  }
  return prisma.scenario.update({
    where: { id },
    data: {
      title: patch.title,
      industry: patch.industry,
      narrative: patch.narrative,
      objectives: patch.objectives,
      totalRounds: patch.totalRounds,
      roundBudget: patch.roundBudget,
      ...(patch.winConditions !== undefined ? { winConditions: toJson(patch.winConditions) } : {}),
      ...(patch.lossConditions !== undefined ? { lossConditions: toJson(patch.lossConditions) } : {}),
      ...(patch.baselineMetrics !== undefined ? { baselineMetrics: toJson(patch.baselineMetrics) } : {}),
      ...(patch.topology !== undefined ? { topology: toJson(patch.topology) } : {}),
      ...(patch.personas !== undefined ? { personas: toJson(patch.personas) } : {}),
      ...(patch.timeline !== undefined ? { timeline: toJson(patch.timeline) } : {}),
      // Editing any field invalidates a prior VALIDATED status until re-validated.
      status: ScenarioStatus.DRAFT,
    },
  });
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/** Re-runs the exact same schema (incl. referential-integrity superRefine) used at generation time against the current, possibly hand-edited, scenario document. */
export async function validateScenario(tenantId: string, id: string): Promise<ValidationResult> {
  const scenario = await getScenario(tenantId, id);
  const candidate = {
    title: scenario.title,
    industry: scenario.industry,
    narrative: scenario.narrative,
    objectives: scenario.objectives,
    winConditions: scenario.winConditions,
    lossConditions: scenario.lossConditions,
    totalRounds: scenario.totalRounds,
    roundBudget: scenario.roundBudget,
    baselineMetrics: scenario.baselineMetrics,
    topology: scenario.topology,
    personas: scenario.personas,
    timeline: scenario.timeline,
  };

  const result = generatedScenarioSchema.safeParse(candidate);
  if (result.success) {
    await prisma.scenario.update({ where: { id }, data: { status: ScenarioStatus.VALIDATED } });
    return { valid: true, issues: [] };
  }

  await prisma.scenario.update({ where: { id }, data: { status: ScenarioStatus.DRAFT } });
  return {
    valid: false,
    issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}

export async function publishScenario(tenantId: string, id: string) {
  const scenario = await getScenario(tenantId, id);
  if (scenario.status !== ScenarioStatus.VALIDATED) {
    throw new BadRequestError("Only a validated scenario can be published — run validation first", "SCENARIO_NOT_VALIDATED");
  }
  return prisma.scenario.update({ where: { id }, data: { status: ScenarioStatus.PUBLISHED } });
}

export async function archiveScenario(tenantId: string, id: string) {
  await getScenario(tenantId, id);
  return prisma.scenario.update({ where: { id }, data: { status: ScenarioStatus.ARCHIVED } });
}

export async function deleteDraftScenario(tenantId: string, id: string) {
  const scenario = await getScenario(tenantId, id);
  if (scenario.status !== ScenarioStatus.DRAFT) {
    throw new ForbiddenError("Only draft scenarios can be deleted — archive published scenarios instead");
  }
  await prisma.scenario.delete({ where: { id } });
}
