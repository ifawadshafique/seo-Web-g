import { z } from "zod";
import prisma from "@/lib/prisma";
import { publicWhere } from "@/lib/publishing";
import { sameOrigin, AuthError } from "@/lib/auth";
import { ContentError, contentResult } from "@/lib/api-error";
import { boundedJson } from "@/lib/request-body";
import { publicRateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/seo";
const input = z.object({
  slug: z.string().min(1).max(75),
  note: z.string().trim().min(10).max(2000),
  website: z.string().max(200).default(""),
  startedAt: z.number(),
});
export async function POST(request: Request) {
  return contentResult(async () => {
    try {
      sameOrigin(request);
    } catch (error) {
      if (error instanceof AuthError)
        return Response.json({ error: "Invalid request" }, { status: 403 });
      throw error;
    }
    const data = input.parse(await boundedJson(request));
    if (
      data.website ||
      Date.now() - data.startedAt < 2000 ||
      Date.now() - data.startedAt > 86400000
    )
      throw new ContentError("Please wait a moment and try again");
    if (!(await publicRateLimit(request, "listing-report", 5, 3600000)))
      throw new ContentError("Too many reports. Please try again later", 429);
    const post = await prisma.post.findFirst({
      where: { ...publicWhere(), slug: data.slug, contentType: "JOB" },
      select: { id: true, slug: true },
    });
    if (!post) throw new ContentError("Listing not found", 404);
    await prisma.$transaction(async (tx) => {
      const report = await tx.jobReport.create({
        data: {
          postId: post.id,
          postUrl: absoluteUrl("/" + post.slug),
          reporterNote: data.note,
        },
      });
      await tx.mailOutbox.create({
        data: {
          subject: "A job listing was reported",
          text: `Report ${report.id} for ${absoluteUrl("/" + post.slug)} needs review within 48 hours. Read the report in the private moderation panel.`,
        },
      });
    });
    return Response.json(
      { ok: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  });
}
