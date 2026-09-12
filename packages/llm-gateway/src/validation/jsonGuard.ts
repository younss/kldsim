import type { ZodError, ZodType } from "zod";
import type { LLMProvider, GenerateJSONOptions, ChatMessage } from "../types.js";
import { LLMValidationError } from "../errors.js";

/**
 * Strips common LLM formatting noise (markdown code fences, leading/trailing
 * prose) so we can attempt JSON.parse even when the model didn't obey a
 * "return only JSON" instruction perfectly.
 */
export function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const candidates = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (candidates.length === 0) return trimmed;
  const start = Math.min(...candidates);
  const isArray = trimmed[start] === "[";
  const end = isArray ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}");
  if (end === -1 || end < start) return trimmed;
  return trimmed.slice(start, end + 1);
}

function summarizeZodError(error: ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export interface JsonGuardResult<T> {
  data: T;
  attempts: number;
  rawFinalResponse: string;
}

/**
 * Calls a single provider repeatedly, feeding validation failures back into
 * the conversation as a correction turn, until the response parses as JSON
 * AND satisfies the provided zod schema — or attempts are exhausted.
 */
export async function generateValidatedJSON<T>(
  provider: LLMProvider,
  options: GenerateJSONOptions<T>,
): Promise<JsonGuardResult<T>> {
  const maxAttempts = (options.maxRepairAttempts ?? 2) + 1;
  const messages: ChatMessage[] = [...options.messages];
  let lastFailureReason = "";
  let lastRaw = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await provider.generateText({
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      responseFormat: "json",
    });
    lastRaw = raw;
    const candidate = extractJsonCandidate(raw);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(candidate);
    } catch (err) {
      lastFailureReason = `Response was not valid JSON: ${(err as Error).message}`;
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `That response could not be parsed as JSON (${lastFailureReason}). Reply again with ONLY a single valid JSON object matching the "${options.schemaName}" schema — no markdown fences, no commentary before or after.`,
      });
      continue;
    }

    const validated = validateAgainstSchema(options.schema, parsedJson);
    if (validated.success) {
      return { data: validated.data, attempts: attempt, rawFinalResponse: raw };
    }

    lastFailureReason = summarizeZodError(validated.error);
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `Your JSON did not satisfy the "${options.schemaName}" schema. Validation errors: ${lastFailureReason}. Reply again with ONLY the corrected JSON object, fixing every listed field.`,
    });
  }

  throw new LLMValidationError(
    `Failed to obtain schema-valid JSON for "${options.schemaName}" after ${maxAttempts} attempt(s): ${lastFailureReason}`,
    { lastRaw, lastFailureReason },
  );
}

function validateAgainstSchema<T>(schema: ZodType<T>, data: unknown) {
  return schema.safeParse(data);
}
