import { LLMProviderKind } from "@kldsim/shared";
import type { LLMProvider, ProviderCredentials, GenerateTextOptions, StreamChunk } from "../types.js";
import { LLMProviderError } from "../errors.js";
import { readNDJSON } from "./streamUtils.js";

interface OllamaChatChunk {
  message?: { role: string; content: string };
  done: boolean;
  error?: string;
}

/**
 * Local-first default provider. Targets a dedicated Ollama container
 * (or host bridge) running lightweight models such as gemma3:4b — no API
 * key required, which is why this adapter is the zero-config out-of-the-box
 * experience for `podman-compose up`.
 */
export class OllamaAdapter implements LLMProvider {
  readonly descriptor;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(creds: ProviderCredentials) {
    this.baseUrl = (creds.baseUrl ?? "http://localhost:11434").replace(/\/+$/, "");
    this.model = creds.model || "gemma3:4b";
    this.descriptor = { kind: LLMProviderKind.OLLAMA, model: this.model };
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        stream: false,
        format: options.responseFormat === "json" ? "json" : undefined,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
    });
    if (!response.ok) {
      throw new LLMProviderError(`Ollama request failed: ${response.status} ${await safeText(response)}`, LLMProviderKind.OLLAMA);
    }
    const data = (await response.json()) as OllamaChatChunk;
    if (!data.message?.content) {
      throw new LLMProviderError("Ollama returned an empty response", LLMProviderKind.OLLAMA);
    }
    return data.message.content;
  }

  async *streamText(options: GenerateTextOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
    });
    if (!response.ok || !response.body) {
      throw new LLMProviderError(`Ollama stream request failed: ${response.status} ${await safeText(response)}`, LLMProviderKind.OLLAMA);
    }
    for await (const line of readNDJSON(response.body)) {
      let parsed: OllamaChatChunk;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.error) throw new LLMProviderError(parsed.error, LLMProviderKind.OLLAMA);
      yield { delta: parsed.message?.content ?? "", done: parsed.done };
      if (parsed.done) return;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<no body>";
  }
}
