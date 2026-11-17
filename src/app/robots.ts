import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules:
      process.env.APP_ENV === "production"
        ? {
            userAgent: "*",
            allow: "/",
            disallow: [
              "/admin",
              "/login",
              "/api/admin/",
              "/api/auth/",
              "/api/cron",
              "/api/security/",
            ],
          }
        : { userAgent: "*", disallow: "/" },
    sitemap: siteOrigin() + "/sitemap.xml",
    host: siteOrigin(),
  };
}
