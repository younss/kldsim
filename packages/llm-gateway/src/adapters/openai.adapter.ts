import { LLMProviderKind } from "@kldsim/shared";
import type { LLMProvider, ProviderCredentials, GenerateTextOptions, StreamChunk } from "../types.js";
import { LLMProviderError } from "../errors.js";
import { readSSE } from "./streamUtils.js";

interface OpenAIChatCompletion {
  choices: Array<{ message?: { content: string }; delta?: { content?: string }; finish_reason: string | null }>;
  error?: { message: string };
}

export class OpenAIAdapter implements LLMProvider {
  readonly descriptor;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(creds: ProviderCredentials) {
    if (!creds.apiKey) throw new LLMProviderError("OpenAI provider requires an API key", LLMProviderKind.OPENAI);
    this.baseUrl = (creds.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.model = creds.model || "gpt-4.1";
    this.apiKey = creds.apiKey;
    this.descriptor = { kind: LLMProviderKind.OPENAI, model: this.model };
  }

  private headers() {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        response_format: options.responseFormat === "json" ? { type: "json_object" } : undefined,
      }),
    });
    const data = (await response.json()) as OpenAIChatCompletion;
    if (!response.ok) {
      throw new LLMProviderError(`OpenAI request failed: ${data.error?.message ?? response.statusText}`, LLMProviderKind.OPENAI);
    }
    const content = data.choices[0]?.message?.content;
    if (!content) throw new LLMProviderError("OpenAI returned an empty response", LLMProviderKind.OPENAI);
    return content;
  }

  async *streamText(options: GenerateTextOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      }),
    });
    if (!response.ok || !response.body) {
      const body = await safeJson(response);
      throw new LLMProviderError(`OpenAI stream request failed: ${body?.error?.message ?? response.statusText}`, LLMProviderKind.OPENAI);
    }
    for await (const payload of readSSE(response.body)) {
      let parsed: OpenAIChatCompletion;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const choice = parsed.choices[0];
      const delta = choice?.delta?.content ?? "";
      const done = choice?.finish_reason != null;
      if (delta.length > 0 || done) yield { delta, done };
    }
    yield { delta: "", done: true };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(4000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

async function safeJson(response: Response): Promise<OpenAIChatCompletion | null> {
  try {
    return (await response.json()) as OpenAIChatCompletion;
  } catch {
    return null;
  }
}
