import { z } from "zod";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { ContentError, contentResult } from "@/lib/api-error";
import { cspStatus } from "@/lib/csp-audit";
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json({
      csp: await cspStatus(),
      violations: await prisma.cspViolation.findMany({
        orderBy: { lastSeenAt: "desc" },
        take: 100,
      }),
      traffic: await prisma.trafficEvent.findMany({
        orderBy: { lastSeenAt: "desc" },
        take: 100,
      }),
      redirects: await prisma.redirect.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    }),
  );
}
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dismiss-violation"),
    key: z.string().length(64),
    note: z.string().trim().min(20).max(1000),
  }),
  z.object({
    action: z.literal("review-csp"),
    note: z.string().trim().min(20).max(1000),
  }),
]);
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const data = input.parse(await request.json());
      if (data.action === "dismiss-violation")
        await prisma.$transaction(async (tx) => {
          await tx.cspViolation.update({
            where: { key: data.key },
            data: { reviewedAt: new Date(), reviewNote: data.note },
          });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "CSP_REPORT_DISMISSED",
              entityType: "CspViolation",
              metadata: { key: data.key },
            },
          });
        });
      else {
        const state = await cspStatus();
        if (
          state.environment !== "staging" ||
          !state.record ||
          state.daysObserved < 7 ||
          state.unreviewedViolations > 0 ||
          Date.now() - state.record.lastSeenAt.getTime() > 10 * 60000
        )
          throw new ContentError(
            "CSP review requires seven uninterrupted staging days with a current heartbeat and no unreviewed violations",
          );
        await prisma.$transaction(async (tx) => {
          await tx.cspAudit.update({
            where: { id: state.record!.id },
            data: {
              reviewedAt: new Date(),
              reviewedBy: session.user.id,
              reviewNote: data.note,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "CSP_STAGING_REVIEWED",
              entityType: "CspAudit",
            },
          });
        });
      }
      return Response.json({ ok: true });
    }),
  );
}
