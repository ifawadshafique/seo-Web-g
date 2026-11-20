import { boundedJson } from "@/lib/request-body";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult } from "@/lib/api-error";
import { cleanBody } from "@/lib/content-validation";
import { revalidatePath } from "next/cache";
const input = z.object({
  slug: z.enum(["about", "contact", "privacy-policy", "terms", "disclaimer"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(100000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  metaTitle: z.string().max(200).default(""),
  metaDesc: z.string().max(500).default(""),
});
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json(await prisma.page.findMany({ orderBy: { title: "asc" } })),
  );
}
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const data = input.parse(await boundedJson(request, 1048576));
      data.body = cleanBody(data.body);
      const page = await prisma.$transaction(async (tx) => {
        const saved = await tx.page.upsert({
          where: { slug: data.slug },
          create: data,
          update: data,
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "PAGE_SAVED",
            entityType: "Page",
            entityId: saved.id,
          },
        });
        return saved;
      });
      revalidatePath("/", "layout");
      return Response.json(page);
    }),
  );
}
