import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import prisma from "./prisma";
import { canAccess } from "./security";

export const draftScope = "content:drafts";
export const metadataPath = "/.well-known/oauth-protected-resource/api/mcp";

export function mcpTokenConfig() {
  const site = endpoint(process.env.SITE_URL);
  const hash = process.env.MCP_ACCESS_TOKEN_HASH;
  const staffId = Number(process.env.MCP_STAFF_USER_ID);
  if (
    !site ||
    !hash ||
    !/^[a-f0-9]{64}$/.test(hash) ||
    !Number.isSafeInteger(staffId) ||
    staffId < 1 ||
    staffId > 2147483647
  )
    return null;
  return { origin: site.origin, hash, staffId };
}

async function staffActor(staffId: number) {
  const actor = await prisma.user.findUnique({
    where: { id: staffId },
    select: { id: true, role: true },
  });
  return actor && canAccess(actor.role, "content") ? actor : null;
}

function bearer(request: Request) {
  return /^Bearer ([^\s,]+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
}

export async function mcpTokenActor(
  request: Request,
  config: NonNullable<ReturnType<typeof mcpTokenConfig>>,
) {
  const token = request.headers.get("x-api-key");
  if (!token || !/^wb_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest();
  return timingSafeEqual(hash, Buffer.from(config.hash, "hex"))
    ? staffActor(config.staffId)
    : null;
}

function endpoint(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local =
      process.env.NODE_ENV === "development" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    return !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === "https:" || (local && url.protocol === "http:"))
      ? url
      : null;
  } catch {
    return null;
  }
}

export function mcpConfig() {
  const site = endpoint(process.env.SITE_URL);
  const issuer = endpoint(process.env.MCP_OAUTH_ISSUER);
  const jwksUrl = endpoint(process.env.MCP_OAUTH_JWKS_URL);
  const subject = process.env.MCP_OAUTH_SUBJECT;
  const staffId = Number(process.env.MCP_STAFF_USER_ID);
  if (
    !site ||
    !issuer ||
    !jwksUrl ||
    issuer.search ||
    !subject ||
    !Number.isSafeInteger(staffId) ||
    staffId < 1 ||
    staffId > 2147483647
  )
    return null;
  return {
    issuer: process.env.MCP_OAUTH_ISSUER!,
    jwksUrl,
    subject,
    staffId,
    resource: new URL("/api/mcp", site).href,
    metadata: new URL(metadataPath, site).href,
  };
}

let keys:
  { url: string; load: ReturnType<typeof createRemoteJWKSet> } | undefined;

export async function mcpActor(
  request: Request,
  config: NonNullable<ReturnType<typeof mcpConfig>>,
) {
  const token = bearer(request);
  if (!token || token.length > 16384) return null;
  if (keys?.url !== config.jwksUrl.href)
    keys = {
      url: config.jwksUrl.href,
      load: createRemoteJWKSet(config.jwksUrl),
    };
  try {
    const { payload } = await jwtVerify(token, keys.load, {
      issuer: config.issuer,
      audience: config.resource,
      subject: config.subject,
      algorithms: ["RS256", "ES256"],
      requiredClaims: ["exp"],
    });
    if (
      typeof payload.scope !== "string" ||
      !payload.scope.split(/\s+/).includes(draftScope)
    )
      return null;
  } catch {
    return null;
  }
  return staffActor(config.staffId);
}
