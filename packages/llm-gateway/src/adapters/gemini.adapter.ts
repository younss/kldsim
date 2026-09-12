import { LLMProviderKind } from "@kldsim/shared";
import type { LLMProvider, ProviderCredentials, GenerateTextOptions, StreamChunk, ChatMessage } from "../types.js";
import { LLMProviderError } from "../errors.js";
import { readSSE } from "./streamUtils.js";

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts: GeminiPart[]; role: string };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string };
}

function toGeminiContents(messages: ChatMessage[]): { systemInstruction?: { parts: GeminiPart[] }; contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> } {
  const systemParts: GeminiPart[] = [];
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push({ text: message.content });
    } else {
      contents.push({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] });
    }
  }
  return { systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined, contents };
}

export class GeminiAdapter implements LLMProvider {
  readonly descriptor;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(creds: ProviderCredentials) {
    if (!creds.apiKey) throw new LLMProviderError("Gemini provider requires an API key", LLMProviderKind.GEMINI);
    this.baseUrl = (creds.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    this.model = creds.model || "gemini-2.0-flash";
    this.apiKey = creds.apiKey;
    this.descriptor = { kind: LLMProviderKind.GEMINI, model: this.model };
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const { systemInstruction, contents } = toGeminiContents(options.messages);
    const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
          responseMimeType: options.responseFormat === "json" ? "application/json" : undefined,
        },
      }),
    });
    const data = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new LLMProviderError(`Gemini request failed: ${data.error?.message ?? response.statusText}`, LLMProviderKind.GEMINI);
    }
    const text = data.candidates?.[0]?.content?.parts.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new LLMProviderError("Gemini returned an empty response", LLMProviderKind.GEMINI);
    return text;
  }

  async *streamText(options: GenerateTextOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { systemInstruction, contents } = toGeminiContents(options.messages);
    const response = await fetch(`${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      }),
    });
    if (!response.ok || !response.body) {
      throw new LLMProviderError(`Gemini stream request failed: ${response.status} ${response.statusText}`, LLMProviderKind.GEMINI);
    }
    for await (const payload of readSSE(response.body)) {
      let parsed: GeminiResponse;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const candidate = parsed.candidates?.[0];
      const delta = candidate?.content?.parts.map((p) => p.text ?? "").join("") ?? "";
      const done = candidate?.finishReason != null;
      if (delta.length > 0 || done) yield { delta, done };
    }
    yield { delta: "", done: true };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, { signal: AbortSignal.timeout(4000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
