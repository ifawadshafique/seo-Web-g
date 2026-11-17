import { cache } from "react";
import { cookies, headers } from "next/headers";
import prisma from "./prisma";
import { siteSettings } from "./settings";
import {
  adConfigurationError,
  advertisingInput,
  defaultSlots,
  adsAllowedOnPath,
} from "./ad-policy";
import { publicWhere } from "./publishing";
import { wordCount } from "./content-validation";
export const advertisingConfig = cache(async () => {
  const [settings, rows] = await Promise.all([
    siteSettings(),
    prisma.adSlot.findMany(),
  ]);
  const slots = defaultSlots.map((fallback) => {
    const row = rows.find((item) => item.key === fallback.key);
    if (!row) return fallback;
    try {
      return {
        key: fallback.key,
        enabled: row.enabled,
        slotId: row.slotId ?? "",
        device: row.device,
        sizes: JSON.parse(row.sizes ?? "null"),
      };
    } catch {
      return fallback;
    }
  });
  const result = advertisingInput.safeParse({
    ads_mode: settings.ads_mode ?? process.env.ADS_MODE ?? "off",
    publisher_id:
      settings.adsense_publisher_id ?? process.env.ADSENSE_PUBLISHER_ID ?? "",
    cookiebot_id:
      settings.cookiebot_id ?? process.env.COOKIEBOT_DOMAIN_GROUP_ID ?? "",
    ga4_id: settings.ga4_id ?? process.env.GA4_MEASUREMENT_ID ?? "",
    slots,
  });
  if (!result.success)
    return {
      ads_mode: "off" as const,
      publisher_id: "",
      cookiebot_id: "",
      ga4_id: "",
      slots: defaultSlots,
    };
  const config = result.data;
  const error = adConfigurationError(config);
  return error ? { ...config, ads_mode: "off" as const } : config;
});
export const publicAdPlan = cache(async () => {
  const path = (await headers()).get("x-page-path") ?? "/";
  const config = await advertisingConfig();
  // Conservatively suppress tracking for any admin session handle, including an expired handle.
  const administrator = (await cookies()).has("seo_session");
  let contentEligible = false;
  if (!administrator && adsAllowedOnPath(path) && config.ads_mode !== "off") {
    if (path === "/")
      contentEligible =
        (await prisma.post.count({ where: publicWhere() })) >= 6;
    else if (path.startsWith("/category/")) {
      const slug = path.split("/")[2];
      const term = await prisma.category.findUnique({
        where: { slug },
        include: { _count: { select: { posts: { where: publicWhere() } } } },
      });
      contentEligible =
        !!term &&
        wordCount(term.description ?? "") >= 150 &&
        term._count.posts >= 6;
    } else if (path.startsWith("/tag/")) {
      const slug = path.split("/")[2];
      const term = await prisma.tag.findUnique({
        where: { slug },
        include: {
          _count: { select: { posts: { where: { post: publicWhere() } } } },
        },
      });
      contentEligible =
        !!term &&
        wordCount(term.description ?? "") >= 150 &&
        term._count.posts >= 6;
    } else if (/^\/[a-z0-9-]+$/.test(path)) {
      const slug = path.slice(1);
      const post = await prisma.post.findFirst({
        where: { ...publicWhere(), slug },
        select: { body: true, adsEnabled: true },
      });
      if (post)
        contentEligible = post.adsEnabled && wordCount(post.body) >= 400;
      else {
        const page = await prisma.page.findFirst({
          where: { slug, status: "PUBLISHED" },
          select: { body: true },
        });
        contentEligible = !!page && wordCount(page.body) >= 400;
      }
    }
  }
  return { ...config, administrator, contentEligible, path };
});
