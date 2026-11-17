import { createHash } from "node:crypto";
import prisma from "./prisma";
export function safePath(value: string) {
  try {
    const path = new URL(value, "http://internal").pathname;
    return path.length <= 200 && /^\/[a-zA-Z0-9_./%-]*$/.test(path)
      ? path
      : "/other";
  } catch {
    return "/other";
  }
}
export async function recordTraffic(
  kind: "NOT_FOUND" | "REDIRECT",
  path: string,
  status: number,
  target?: string,
) {
  path = safePath(path);
  if (/^\/(api|admin|login|report)(\/|$)/.test(path)) return;
  const key = createHash("sha256")
    .update(kind + ":" + path + ":" + (target ?? ""))
    .digest("hex");
  await prisma.trafficEvent.upsert({
    where: { key },
    create: { key, kind, path, status, target },
    update: { hits: { increment: 1 }, lastSeenAt: new Date() },
  });
}
