import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { compare, hash } from "bcryptjs";
import { generateSecret, generateURI, verify } from "otplib";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const hashPassword = (password: string) => hash(password, 12);
export const checkPassword = (password: string, encoded: string) =>
  compare(password, encoded);
function key() {
  const value = process.env.AUTH_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "AUTH_ENCRYPTION_KEY must contain 64 hexadecimal characters",
    );
  return Buffer.from(value, "hex");
}
export function encrypt(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(secret),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const data = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    cipher.update(data.subarray(12, -16)),
    cipher.final(),
  ]).toString();
}
export { generateSecret, generateURI };
export async function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  return (await verify({ secret, token: code, epochTolerance: 0 })).valid;
}
export const otpStep = () => BigInt(Math.floor(Date.now() / 30000));
export function canAccess(
  role: string,
  area: "content" | "settings" | "users" | "audit",
) {
  return role === "ADMIN" || (role === "EDITOR" && area === "content");
}
export function localMfaBypass(
  source: Record<string, string | undefined> = process.env,
) {
  return (
    source.APP_ENV === "local" &&
    source.NODE_ENV === "development" &&
    source.LOCAL_AUTH_SKIP_MFA === "true"
  );
}
export function sessionValid(
  session: {
    version: number;
    mfaVerified: boolean;
    expiresAt: Date;
    lastSeenAt: Date;
  },
  user: { sessionVersion: number; role: string; mfaEnabled: boolean },
  now = new Date(),
  passwordOnly = false,
) {
  return (
    session.version === user.sessionVersion &&
    session.expiresAt > now &&
    now.getTime() - session.lastSeenAt.getTime() < 30 * 60 * 1000 &&
    ((session.mfaVerified && (user.role !== "ADMIN" || user.mfaEnabled)) ||
      localMfaBypass() ||
      passwordOnly)
  );
}

// Maintained iron-session seals the opaque handle; the database remains authoritative.
export async function sealToken(value: string) {
  const { sealData } = await import("iron-session");
  return sealData(
    { token: value },
    { password: key().toString("hex"), ttl: 12 * 3600 },
  );
}
export async function readToken(value: string | undefined) {
  if (!value) return null;
  const { unsealData } = await import("iron-session");
  const data = await unsealData<{ token?: string }>(value, {
    password: key().toString("hex"),
    ttl: 12 * 3600,
  });
  return data.token && /^[a-f0-9]{64}$/.test(data.token) ? data.token : null;
}
