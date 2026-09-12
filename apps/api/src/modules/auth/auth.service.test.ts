import { describe, it, expect } from "vitest";
import { PlatformRole } from "@kldsim/shared";
import { signAccessToken, verifyAccessToken, hashPassword, verifyPassword } from "./auth.service.js";

describe("access token sign/verify round trip", () => {
  it("recovers the same payload it signed", () => {
    const token = signAccessToken({ sub: "user-1", tenantId: "tenant-1", role: PlatformRole.FACILITATOR, email: "f@example.com" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.tenantId).toBe("tenant-1");
    expect(payload.role).toBe(PlatformRole.FACILITATOR);
    expect(payload.email).toBe("f@example.com");
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken({ sub: "user-1", tenantId: "tenant-1", role: PlatformRole.PLAYER, email: "p@example.com" });
    const tampered = token.slice(0, -2) + "xx";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe("password hashing", () => {
  it("round-trips a password through hash and verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
});
