import type { ZodType } from "zod";
import type { LLMProviderKind } from "@kldsim/shared";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateTextOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Hint adapters use to enable provider-native JSON mode when available. */
  responseFormat?: "text" | "json";
}

export interface GenerateJSONOptions<T> extends GenerateTextOptions {
  schema: ZodType<T>;
  /** Short identifier used by adapters that support native structured output / function calling. */
  schemaName: string;
  /** How many repair round-trips to attempt before giving up. Default 2. */
  maxRepairAttempts?: number;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

/** Static description of a provider instance, safe to expose to clients (never includes secrets). */
export interface ProviderDescriptor {
  kind: LLMProviderKind;
  model: string;
}

export interface LLMProvider {
  readonly descriptor: ProviderDescriptor;
  generateText(options: GenerateTextOptions): Promise<string>;
  streamText(options: GenerateTextOptions): AsyncGenerator<StreamChunk, void, unknown>;
  /** Cheap connectivity/auth check used by the provider-config UI and container healthchecks. */
  healthCheck(): Promise<boolean>;
}

export interface ProviderCredentials {
  provider: LLMProviderKind;
  model: string;
  /** Plaintext API key, already decrypted by the caller. Absent for Ollama. */
  apiKey?: string;
  /** Ollama / self-hosted override, e.g. http://ollama:11434 */
  baseUrl?: string;
}
