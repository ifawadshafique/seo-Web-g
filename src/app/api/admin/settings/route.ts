import { boundedJson } from "@/lib/request-body";
import { z } from "zod";
import { protectedRoute } from "@/lib/auth";
import { contentResult } from "@/lib/api-error";
import { siteSettings } from "@/lib/settings";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
const input = z.object({
  site_name: z.string().trim().min(1).max(100),
  site_timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone"),
  default_meta_description: z.string().max(500),
  logo: z
    .string()
    .refine(
      (value) => value === "" || /^\/api\/media\/[a-f0-9-]+\.webp$/.test(value),
      "Choose an uploaded image",
    ),
  social_links: z
    .string()
    .max(2000)
    .refine(
      (value) =>
        value
          .split(/\s+/)
          .filter(Boolean)
          .every((link) => {
            try {
              return new URL(link).protocol === "https:";
            } catch {
              return false;
            }
          }),
      "Supply HTTPS links, separated by spaces",
    ),
  expired_job_policy: z.enum(["retain", "archive", "remove"]),
  tag_index_threshold: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(5)
    .transform(String),
});
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json(await siteSettings()),
  );
}
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const data = input.parse(await boundedJson(request, 65536));
      await prisma.$transaction(async (tx) => {
        for (const [key, value] of Object.entries(data))
          await tx.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "SETTINGS_SAVED",
            entityType: "Setting",
          },
        });
      });
      revalidatePath("/", "layout");
      return Response.json({ ok: true });
    }),
  );
}
