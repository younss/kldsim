import type { UUID, ISODateString, LLMProviderKind } from "./common.js";

/**
 * Per-tenant configuration for a pluggable LLM provider. `encryptedApiKey` is
 * never sent to the client — API responses must redact it to a boolean `configured` flag.
 */
export interface ProviderConfig {
  id: UUID;
  tenantId: UUID;
  provider: LLMProviderKind;
  /** e.g. "gemini-2.0-flash", "claude-sonnet-5", "gpt-4.1", "gemma3:4b" */
  model: string;
  /** Ollama / self-hosted only. */
  baseUrl: string | null;
  encryptedApiKey: string | null;
  isDefault: boolean;
  enabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ProviderConfigPublic = Omit<ProviderConfig, "encryptedApiKey"> & {
  configured: boolean;
};
