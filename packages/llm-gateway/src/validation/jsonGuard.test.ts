import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateValidatedJSON, extractJsonCandidate } from "./jsonGuard.js";
import { LLMValidationError } from "../errors.js";
import type { LLMProvider, GenerateTextOptions, StreamChunk } from "../types.js";
import { LLMProviderKind } from "@kldsim/shared";

class FakeProvider implements LLMProvider {
  readonly descriptor = { kind: LLMProviderKind.OLLAMA, model: "fake" };
  public calls: GenerateTextOptions[] = [];
  constructor(private responses: string[]) {}

  async generateText(options: GenerateTextOptions): Promise<string> {
    this.calls.push(options);
    const next = this.responses.shift();
    if (next === undefined) throw new Error("FakeProvider ran out of canned responses");
    return next;
  }

  async *streamText(): AsyncGenerator<StreamChunk, void, unknown> {
    throw new Error("not implemented");
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

const schema = z.object({ name: z.string(), age: z.number().min(0) });

describe("extractJsonCandidate", () => {
  it("unwraps a fenced json block", () => {
    const raw = "Sure thing!\n```json\n{\"a\":1}\n```\nHope that helps.";
    expect(extractJsonCandidate(raw)).toBe('{"a":1}');
  });

  it("trims stray prose around a bare object", () => {
    const raw = 'Here you go: {"a":1} thanks!';
    expect(extractJsonCandidate(raw)).toBe('{"a":1}');
  });
});

describe("generateValidatedJSON", () => {
  it("returns immediately when the first response is already valid", async () => {
    const provider = new FakeProvider(['{"name":"Ada","age":30}']);
    const result = await generateValidatedJSON(provider, {
      messages: [{ role: "user", content: "give me a person" }],
      schema,
      schemaName: "Person",
    });
    expect(result.data).toEqual({ name: "Ada", age: 30 });
    expect(result.attempts).toBe(1);
  });

  it("repairs after a malformed-JSON response", async () => {
    const provider = new FakeProvider(["not json at all", '{"name":"Grace","age":45}']);
    const result = await generateValidatedJSON(provider, {
      messages: [{ role: "user", content: "give me a person" }],
      schema,
      schemaName: "Person",
    });
    expect(result.data.name).toBe("Grace");
    expect(result.attempts).toBe(2);
    expect(provider.calls[1]!.messages.at(-1)!.content).toMatch(/not be parsed as JSON/);
  });

  it("repairs after a schema-violating response", async () => {
    const provider = new FakeProvider(['{"name":"Ada","age":-5}', '{"name":"Ada","age":30}']);
    const result = await generateValidatedJSON(provider, {
      messages: [{ role: "user", content: "give me a person" }],
      schema,
      schemaName: "Person",
    });
    expect(result.data.age).toBe(30);
    expect(provider.calls[1]!.messages.at(-1)!.content).toMatch(/did not satisfy/);
  });

  it("throws LLMValidationError once repair attempts are exhausted", async () => {
    const provider = new FakeProvider(["garbage", "still garbage", "nope"]);
    await expect(
      generateValidatedJSON(provider, {
        messages: [{ role: "user", content: "give me a person" }],
        schema,
        schemaName: "Person",
        maxRepairAttempts: 2,
      }),
    ).rejects.toBeInstanceOf(LLMValidationError);
  });
});
