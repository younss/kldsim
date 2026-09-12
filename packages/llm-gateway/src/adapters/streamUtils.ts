/**
 * Low-level byte-stream readers shared by every adapter. Node's global
 * fetch (undici) returns a WHATWG ReadableStream body, so both readers work
 * identically in the API server and would work in a browser too.
 */

async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) yield line;
      }
    }
    if (buffer.trim().length > 0) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
}

/** Server-Sent Events: yields the payload of each "data: ..." line, skipping "[DONE]" and comments. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  for await (const line of readLines(body)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") return;
    yield payload;
  }
}

/** Newline-delimited JSON (Ollama's native streaming format). */
export async function* readNDJSON(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  for await (const line of readLines(body)) {
    yield line;
  }
}
