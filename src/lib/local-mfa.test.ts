import { afterEach, expect, it, vi } from "vitest";
import { localMfaBypass, sessionValid } from "./security";
afterEach(() => vi.unstubAllEnvs());
it("permits bypass only in explicitly configured local development", () => {
  const base = {
    APP_ENV: "local",
    NODE_ENV: "development",
    LOCAL_AUTH_SKIP_MFA: "true",
  };
  expect(localMfaBypass(base)).toBe(true);
  for (const APP_ENV of ["staging", "production", undefined])
    expect(localMfaBypass({ ...base, APP_ENV })).toBe(false);
  for (const NODE_ENV of ["production", "test", undefined])
    expect(localMfaBypass({ ...base, NODE_ENV })).toBe(false);
  expect(localMfaBypass({ ...base, LOCAL_AUTH_SKIP_MFA: "false" })).toBe(false);
});
it("invalidates bypassed sessions when disabled and preserves expiry checks", () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LOCAL_AUTH_SKIP_MFA", "true");
  const now = new Date();
  const session = {
    version: 1,
    mfaVerified: false,
    expiresAt: new Date(+now + 60000),
    lastSeenAt: now,
  };
  const user = { sessionVersion: 1, role: "ADMIN", mfaEnabled: false };
  expect(sessionValid(session, user, now)).toBe(true);
  expect(sessionValid({ ...session, expiresAt: now }, user, now)).toBe(false);
  expect(sessionValid(session, { ...user, sessionVersion: 2 }, now)).toBe(
    false,
  );
  vi.stubEnv("LOCAL_AUTH_SKIP_MFA", "false");
  expect(sessionValid(session, user, now)).toBe(false);
  expect(sessionValid(session, { ...user, mfaEnabled: true }, now)).toBe(false);
});
