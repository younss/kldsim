import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto.js";

describe("envelope encryption", () => {
  const masterKey = "test-master-key-do-not-use-in-prod";

  it("round-trips a secret", () => {
    const plaintext = "sk-ant-super-secret-key-12345";
    const encrypted = encryptSecret(plaintext, masterKey);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted, masterKey)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-secret", masterKey);
    const b = encryptSecret("same-secret", masterKey);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong master key", () => {
    const encrypted = encryptSecret("some-api-key", masterKey);
    expect(() => decryptSecret(encrypted, "wrong-key")).toThrow();
  });
});
