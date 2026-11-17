import { cache } from "react";
import prisma from "./prisma";
export const siteSettings = cache(async () => {
  const rows = await prisma.setting.findMany();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    site_name: "Workboard",
    site_timezone: process.env.SITE_TIMEZONE ?? "Asia/Karachi",
    default_meta_description:
      "Explore job opportunities and practical career advice. Read the details, check the source, and apply directly with the employer.",
    expired_job_policy: "retain",
    logo: "",
    social_links: "",
    tag_index_threshold: "5",
    ads_mode: process.env.ADS_MODE ?? "off",
    adsense_publisher_id: process.env.ADSENSE_PUBLISHER_ID ?? "",
    cookiebot_id: process.env.COOKIEBOT_DOMAIN_GROUP_ID ?? "",
    ga4_id: process.env.GA4_MEASUREMENT_ID ?? "",
    ...values,
  };
});
