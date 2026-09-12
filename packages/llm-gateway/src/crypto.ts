import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Envelope encryption for tenant-supplied BYO-AI API keys at rest.
 * AES-256-GCM with a per-secret random IV; the master key is never stored
 * in the database, only in the process environment (MASTER_ENCRYPTION_KEY).
 * Encoded form: base64(iv(12) || authTag(16) || ciphertext).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(masterKey: string): Buffer {
  // Accept either a raw 32-byte base64 key or an arbitrary passphrase; hash
  // to a fixed 32-byte key either way so operators can't misconfigure length.
  return createHash("sha256").update(masterKey, "utf8").digest();
}

export function encryptSecret(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
