import { boundedJson } from "@/lib/request-body";
import { publicRateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import { policyHash } from "@/lib/csp";
import { safePath } from "@/lib/traffic";
import { createHash } from "node:crypto";
export async function POST(request: Request) {
  try {
    if (!(await publicRateLimit(request, "csp-report", 30, 60000)))
      return new Response(null, { status: 429 });
    const body = await boundedJson(request, 16000);
    const reports = Array.isArray(body) ? body.slice(0, 10) : [body];
    for (const item of reports) {
      if (!item || typeof item !== "object") continue;
      const wrapped = item as Record<string, unknown>;
      const report = (wrapped["csp-report"] ??
        wrapped.body ??
        wrapped) as Record<string, unknown>;
      if (!report || typeof report !== "object") continue;
      const original = String(
        report["original-policy"] ?? report.originalPolicy ?? "",
      );
      if (!original || original.length > 6000) continue;
      const directive = String(
        report["effective-directive"] ??
          report.effectiveDirective ??
          report["violated-directive"] ??
          "",
      ).slice(0, 100);
      if (!/^[a-z-]+$/.test(directive)) continue;
      const raw = String(report["blocked-uri"] ?? report.blockedURL ?? "");
      let blockedOrigin = "other";
      try {
        blockedOrigin = new URL(raw).origin;
        if (blockedOrigin === "null") blockedOrigin = "other";
      } catch {
        if (["inline", "eval", "self", "data", "blob"].includes(raw))
          blockedOrigin = raw;
      }
      const path = safePath(
        String(report["document-uri"] ?? report.documentURL ?? "/"),
      );
      const hash = policyHash(original);
      const disposition = String(report.disposition ?? "report").slice(0, 20);
      const key = createHash("sha256")
        .update([hash, directive, blockedOrigin, path, disposition].join("|"))
        .digest("hex");
      await prisma.cspViolation.upsert({
        where: { key },
        create: {
          key,
          policyHash: hash,
          directive,
          blockedOrigin,
          path,
          disposition,
        },
        update: {
          hits: { increment: 1 },
          lastSeenAt: new Date(),
          reviewedAt: null,
          reviewNote: null,
        },
      });
    }
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 400 });
  }
}
