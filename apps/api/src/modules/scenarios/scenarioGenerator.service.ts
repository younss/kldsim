import type { ScenarioAuthoringRequest } from "@kldsim/shared";
import { generatedScenarioSchema } from "@kldsim/shared";
import type { LLMGateway } from "@kldsim/llm-gateway";
import { buildScenarioGenerationMessages } from "@kldsim/llm-gateway";

export interface GenerateScenarioResult {
  generated: import("@kldsim/shared").GeneratedScenarioSchemaType;
  providerUsed: string;
  modelUsed: string;
  attempts: number;
}

/**
 * Pure orchestration: builds the prompt, drives the gateway's validated-JSON
 * loop, and hands back the typed payload. Persistence lives in
 * scenarios.service so this stays trivially reusable from both the HTTP
 * route (small/interactive) and the background worker (large scenarios).
 */
export async function generateScenarioPayload(gateway: LLMGateway, request: ScenarioAuthoringRequest): Promise<GenerateScenarioResult> {
  const messages = buildScenarioGenerationMessages({
    prompt: request.prompt,
    industry: request.industry,
    totalRounds: request.totalRounds,
    difficulty: request.difficulty,
  });

  const result = await gateway.generateJSON({
    messages,
    schema: generatedScenarioSchema,
    schemaName: "GeneratedScenario",
    temperature: 0.9,
    maxTokens: 8000,
    maxRepairAttempts: 3,
  });

  return { generated: result.data, providerUsed: result.providerUsed, modelUsed: result.modelUsed, attempts: result.attempts };
}
