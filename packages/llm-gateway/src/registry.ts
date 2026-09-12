import { LLMProviderKind } from "@kldsim/shared";
import type { LLMProvider, ProviderCredentials, GenerateJSONOptions, GenerateTextOptions, StreamChunk } from "./types.js";
import { OllamaAdapter } from "./adapters/ollama.adapter.js";
import { OpenAIAdapter } from "./adapters/openai.adapter.js";
import { ClaudeAdapter } from "./adapters/claude.adapter.js";
import { GeminiAdapter } from "./adapters/gemini.adapter.js";
import { generateValidatedJSON } from "./validation/jsonGuard.js";
import { AllProvidersFailedError, LLMProviderError } from "./errors.js";
import type { ProviderAttemptFailure } from "./errors.js";

/** Strategy/Adapter-pattern factory: the only place that knows every concrete adapter class. */
export function createProvider(credentials: ProviderCredentials): LLMProvider {
  switch (credentials.provider) {
    case LLMProviderKind.OLLAMA:
      return new OllamaAdapter(credentials);
    case LLMProviderKind.OPENAI:
      return new OpenAIAdapter(credentials);
    case LLMProviderKind.CLAUDE:
      return new ClaudeAdapter(credentials);
    case LLMProviderKind.GEMINI:
      return new GeminiAdapter(credentials);
    default:
      throw new LLMProviderError(`Unknown provider kind: ${credentials.provider}`, credentials.provider);
  }
}

export interface GenerateJSONResult<T> {
  data: T;
  providerUsed: LLMProviderKind;
  modelUsed: string;
  attempts: number;
}

/**
 * The single entry point business logic should depend on. Holds an ordered
 * list of providers — index 0 is the tenant's configured default, the rest
 * are fallbacks — and tries each in turn so a scenario-generation or
 * negotiation-scoring call degrades gracefully instead of hard-failing when
 * one provider is down, rate-limited, or misconfigured.
 */
export class LLMGateway {
  constructor(private readonly providers: LLMProvider[]) {
    if (providers.length === 0) {
      throw new Error("LLMGateway requires at least one provider");
    }
  }

  static fromCredentials(credentialsList: ProviderCredentials[]): LLMGateway {
    return new LLMGateway(credentialsList.map(createProvider));
  }

  get primary(): LLMProvider {
    return this.providers[0]!;
  }

  async generateJSON<T>(options: GenerateJSONOptions<T>): Promise<GenerateJSONResult<T>> {
    const failures: ProviderAttemptFailure[] = [];
    for (const provider of this.providers) {
      try {
        const result = await generateValidatedJSON(provider, options);
        return {
          data: result.data,
          providerUsed: provider.descriptor.kind,
          modelUsed: provider.descriptor.model,
          attempts: result.attempts,
        };
      } catch (err) {
        failures.push({
          provider: provider.descriptor.kind,
          model: provider.descriptor.model,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw new AllProvidersFailedError(failures);
  }

  async generateText(options: GenerateTextOptions): Promise<{ text: string; providerUsed: LLMProviderKind }> {
    const failures: ProviderAttemptFailure[] = [];
    for (const provider of this.providers) {
      try {
        const text = await provider.generateText(options);
        return { text, providerUsed: provider.descriptor.kind };
      } catch (err) {
        failures.push({
          provider: provider.descriptor.kind,
          model: provider.descriptor.model,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw new AllProvidersFailedError(failures);
  }

  /**
   * Streaming only falls back *before* the first byte: once tokens start
   * flowing from a provider we commit to it, since splicing providers
   * mid-stream would produce an incoherent transcript for the player.
   */
  async *streamText(options: GenerateTextOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const failures: ProviderAttemptFailure[] = [];
    for (const provider of this.providers) {
      try {
        const iterator = provider.streamText(options);
        const first = await iterator.next();
        if (first.done) return;
        yield first.value;
        yield* iterator;
        return;
      } catch (err) {
        failures.push({
          provider: provider.descriptor.kind,
          model: provider.descriptor.model,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw new AllProvidersFailedError(failures);
  }

  async healthCheckAll(): Promise<Array<{ provider: LLMProviderKind; model: string; healthy: boolean }>> {
    return Promise.all(
      this.providers.map(async (provider) => ({
        provider: provider.descriptor.kind,
        model: provider.descriptor.model,
        healthy: await provider.healthCheck(),
      })),
    );
  }
}
