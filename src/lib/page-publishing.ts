import { z } from "zod";
import { cleanBody } from "./content-validation";
import prisma from "./prisma";

export const pageInput = z.object({
  slug: z.enum(["about", "contact", "privacy-policy", "terms", "disclaimer"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(100000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  metaTitle: z.string().max(200).default(""),
  metaDesc: z.string().max(500).default(""),
});

export function savePage(input: unknown, actorId: number, draftOnly = false) {
  const data = pageInput.parse(input);
  data.body = cleanBody(data.body);
  if (draftOnly) data.status = "DRAFT";

  return prisma.$transaction(async (tx) => {
    const saved = await tx.page.upsert({
      where: { slug: data.slug },
      create: data,
      update: draftOnly ? {} : data,
    });
    const page = draftOnly
      ? await tx.page.update({
          where: { id: saved.id, status: "DRAFT" },
          data,
        })
      : saved;
    await tx.auditLog.create({
      data: {
        actorId,
        action: "PAGE_SAVED",
        entityType: "Page",
        entityId: page.id,
      },
    });
    return page;
  });
}
