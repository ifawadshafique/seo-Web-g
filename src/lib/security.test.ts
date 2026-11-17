import { describe, it, expect } from "vitest";
import { generate } from "otplib";
import {
  canAccess,
  checkPassword,
  decrypt,
  digest,
  encrypt,
  generateSecret,
  hashPassword,
  sessionValid,
  verifyTotp,
} from "./security";
describe("authentication security", () => {
  it("hashes passwords and rejects incorrect ones", async () => {
    const value = await hashPassword("a long test password");
    expect(await checkPassword("a long test password", value)).toBe(true);
    expect(await checkPassword("wrong", value)).toBe(false);
  });
  it("encrypts secrets with authenticated encryption", () => {
    process.env.AUTH_ENCRYPTION_KEY = "ab".repeat(32);
    const value = encrypt("private");
    expect(value).not.toContain("private");
    expect(decrypt(value)).toBe("private");
    const tampered = Buffer.from(value, "base64");
    tampered[15] ^= 1;
    expect(() => decrypt(tampered.toString("base64"))).toThrow();
  });
  it("validates authenticator codes", async () => {
    const secret = generateSecret();
    expect(await verifyTotp(secret, await generate({ secret }))).toBe(true);
    expect(await verifyTotp(secret, "invalid")).toBe(false);
  });
  it("enforces role boundaries", () => {
    expect(canAccess("EDITOR", "content")).toBe(true);
    for (const area of ["settings", "users", "audit"] as const) {
      expect(canAccess("EDITOR", area)).toBe(false);
      expect(canAccess("ADMIN", area)).toBe(true);
    }
    expect(canAccess("USER", "content")).toBe(false);
  });
  it("rejects pending, revoked, idle and expired sessions", () => {
    const now = new Date();
    const user = { role: "ADMIN", sessionVersion: 1, mfaEnabled: true };
    const session = {
      version: 1,
      mfaVerified: true,
      expiresAt: new Date(+now + 60000),
      lastSeenAt: now,
    };
    expect(sessionValid(session, user, now)).toBe(true);
    expect(sessionValid({ ...session, mfaVerified: false }, user, now)).toBe(
      false,
    );
    expect(sessionValid(session, { ...user, sessionVersion: 2 }, now)).toBe(
      false,
    );
    expect(sessionValid(session, { ...user, mfaEnabled: false }, now)).toBe(
      false,
    );
    expect(
      sessionValid(
        { ...session, lastSeenAt: new Date(+now - 1800000) },
        user,
        now,
      ),
    ).toBe(false);
    expect(sessionValid({ ...session, expiresAt: now }, user, now)).toBe(false);
  });
  it("stores only digests of bearer tokens", () => {
    expect(digest("secret")).toHaveLength(64);
    expect(digest("secret")).not.toContain("secret");
  });
});
