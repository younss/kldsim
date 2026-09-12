import { LLMProviderKind } from "@kldsim/shared";
import type { LLMProvider, ProviderCredentials, GenerateTextOptions, StreamChunk, ChatMessage } from "../types.js";
import { LLMProviderError } from "../errors.js";
import { readSSE } from "./streamUtils.js";

const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
  error?: { message: string };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  error?: { message: string };
}

function splitSystemPrompt(messages: ChatMessage[]): { system: string; rest: Array<{ role: "user" | "assistant"; content: string }> } {
  const systemParts: string[] = [];
  const rest: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
    } else {
      rest.push({ role: message.role, content: message.content });
    }
  }
  return { system: systemParts.join("\n\n"), rest };
}

export class ClaudeAdapter implements LLMProvider {
  readonly descriptor;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(creds: ProviderCredentials) {
    if (!creds.apiKey) throw new LLMProviderError("Claude provider requires an API key", LLMProviderKind.CLAUDE);
    this.baseUrl = (creds.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.model = creds.model || "claude-sonnet-5";
    this.apiKey = creds.apiKey;
    this.descriptor = { kind: LLMProviderKind.CLAUDE, model: this.model };
  }

  private headers() {
    return {
      "content-type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    };
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const { system, rest } = splitSystemPrompt(options.messages);
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        system: system || undefined,
        messages: rest,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      }),
    });
    const data = (await response.json()) as AnthropicMessageResponse;
    if (!response.ok) {
      throw new LLMProviderError(`Claude request failed: ${data.error?.message ?? response.statusText}`, LLMProviderKind.CLAUDE);
    }
    const text = data.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
    if (!text) throw new LLMProviderError("Claude returned an empty response", LLMProviderKind.CLAUDE);
    return text;
  }

  async *streamText(options: GenerateTextOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { system, rest } = splitSystemPrompt(options.messages);
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        system: system || undefined,
        messages: rest,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
    });
    if (!response.ok || !response.body) {
      throw new LLMProviderError(`Claude stream request failed: ${response.status} ${response.statusText}`, LLMProviderKind.CLAUDE);
    }
    for await (const payload of readSSE(response.body)) {
      let event: AnthropicStreamEvent;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.type === "error") {
        throw new LLMProviderError(event.error?.message ?? "Claude stream error", LLMProviderKind.CLAUDE);
      }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        yield { delta: event.delta.text ?? "", done: false };
      }
      if (event.type === "message_stop") {
        yield { delta: "", done: true };
        return;
      }
    }
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
