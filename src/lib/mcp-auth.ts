import { createRemoteJWKSet, jwtVerify } from "jose";
import prisma from "./prisma";
import { canAccess } from "./security";

export const draftScope = "content:drafts";
export const metadataPath = "/.well-known/oauth-protected-resource/api/mcp";

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
  const token = /^Bearer ([^\s,]+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
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
  const actor = await prisma.user.findUnique({
    where: { id: config.staffId },
    select: { id: true, role: true },
  });
  return actor && canAccess(actor.role, "content") ? actor : null;
}
