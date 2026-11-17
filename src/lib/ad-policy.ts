import { z } from "zod";
export const slotKeys = [
  "header",
  "in-article-1",
  "in-article-2",
  "end-of-post",
  "sidebar",
  "in-feed",
] as const;
const pair = z.tuple([z.number().int(), z.number().int()]);
const allowed = new Set([
  "320x100",
  "300x250",
  "336x280",
  "728x90",
  "970x90",
  "300x600",
]);
export const slotInput = z
  .object({
    key: z.enum(slotKeys),
    enabled: z.boolean(),
    slotId: z.union([z.string().regex(/^\d{6,20}$/), z.literal("")]),
    device: z.enum(["ALL", "MOBILE", "DESKTOP"]),
    sizes: z
      .object({ mobile: pair, desktop: pair })
      .refine(
        (value) =>
          value.mobile[0] === 320 &&
          value.mobile[1] === 100 &&
          allowed.has(value.desktop.join("x")),
        "Use a 320×100 mobile region and an approved desktop size",
      ),
  })
  .strict()
  .superRefine((slot, ctx) => {
    const size = slot.sizes.desktop.join("x");
    if (slot.key === "header" && !["728x90", "970x90"].includes(size))
      ctx.addIssue({
        code: "custom",
        message: "Header placements require a banner size",
      });
    if (
      slot.key === "sidebar" &&
      (!["300x250", "300x600"].includes(size) || slot.device !== "DESKTOP")
    )
      ctx.addIssue({
        code: "custom",
        message: "Sidebar placements require a desktop-only sidebar size",
      });
    if (
      !["header", "sidebar"].includes(slot.key) &&
      !["300x250", "336x280", "728x90"].includes(size)
    )
      ctx.addIssue({
        code: "custom",
        message: "Use an approved content-column ad size",
      });
  });
export const advertisingInput = z
  .object({
    ads_mode: z.enum(["off", "placeholder", "live"]),
    publisher_id: z.union([z.string().regex(/^pub-\d{10,20}$/), z.literal("")]),
    cookiebot_id: z.union([z.string().uuid(), z.literal("")]),
    ga4_id: z.union([z.string().regex(/^G-[A-Z0-9]{4,20}$/), z.literal("")]),
    slots: z
      .array(slotInput)
      .length(6)
      .refine(
        (values) => new Set(values.map((value) => value.key)).size === 6,
        "Configure each placement once",
      ),
  })
  .strict();
export type SlotConfig = z.infer<typeof slotInput>;
export type AdvertisingConfig = z.infer<typeof advertisingInput>;
export const defaultSlots: SlotConfig[] = slotKeys.map((key) => ({
  key,
  enabled: false,
  slotId: "",
  device: key === "sidebar" ? "DESKTOP" : "ALL",
  sizes: {
    mobile: [320, 100],
    desktop:
      key === "header"
        ? [728, 90]
        : key === "sidebar"
          ? [300, 600]
          : [336, 280],
  },
}));
export function adConfigurationError(
  config: AdvertisingConfig,
  source: Record<string, string | undefined> = process.env,
) {
  if (config.ads_mode === "placeholder" && source.APP_ENV !== "staging")
    return "Ad placeholders are permitted only on staging";
  if (config.ads_mode === "live") {
    if (source.ADSENSE_APPROVED !== "true")
      return "AdSense approval must be recorded in deployment configuration before live ads can be enabled";
    if (
      !config.publisher_id ||
      !config.cookiebot_id ||
      source.COOKIEBOT_TCF_ENABLED !== "true"
    )
      return "Live ads require a publisher ID and Cookiebot configured with IAB TCF enabled";
    if (config.slots.some((slot) => slot.enabled && !slot.slotId))
      return "Each enabled live placement requires an approved slot ID";
  }
  return null;
}
export function adsAllowedOnPath(path: string) {
  return !/^\/(admin|login|search|contact|404|report|thank-you|api)(\/|$)/.test(
    path,
  );
}
