import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { ContentError, contentResult } from "@/lib/api-error";
import { advertisingConfig } from "@/lib/advertising";
import { advertisingInput, adConfigurationError } from "@/lib/ad-policy";
import { revalidatePath } from "next/cache";
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json(await advertisingConfig()),
  );
}
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const config = advertisingInput.parse(await request.json());
      const error = adConfigurationError(config);
      if (error) throw new ContentError(error);
      await prisma.$transaction(async (tx) => {
        for (const [key, value] of Object.entries({
          ads_mode: config.ads_mode,
          adsense_publisher_id: config.publisher_id,
          cookiebot_id: config.cookiebot_id,
          ga4_id: config.ga4_id,
        }))
          await tx.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          });
        for (const slot of config.slots) {
          const old = await tx.adSlot.findFirst({ where: { key: slot.key } });
          const data = {
            key: slot.key,
            enabled: slot.enabled,
            slotId: slot.slotId,
            device: slot.device,
            placement: slot.key,
            sizes: JSON.stringify(slot.sizes),
            minHeight: slot.sizes.mobile[1],
          };
          if (old) await tx.adSlot.update({ where: { id: old.id }, data });
          else await tx.adSlot.create({ data });
        }
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "AD_CONFIGURATION_SAVED",
            entityType: "AdSlot",
            metadata: { mode: config.ads_mode },
          },
        });
      });
      revalidatePath("/", "layout");
      return Response.json({ ok: true });
    }),
  );
}
