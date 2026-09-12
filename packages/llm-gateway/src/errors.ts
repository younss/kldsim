import type { LLMProviderKind } from "@kldsim/shared";

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProviderKind,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export class LLMValidationError extends Error {
  constructor(
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = "LLMValidationError";
  }
}

export interface ProviderAttemptFailure {
  provider: LLMProviderKind;
  model: string;
  error: string;
}

export class AllProvidersFailedError extends Error {
  constructor(public readonly attempts: ProviderAttemptFailure[]) {
    super(`All configured LLM providers failed: ${attempts.map((a) => `${a.provider}(${a.model}): ${a.error}`).join("; ")}`);
    this.name = "AllProvidersFailedError";
  }
}
