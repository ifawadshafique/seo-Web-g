import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";
import { publicIndexingEnabled } from "@/lib/public-indexing";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: publicIndexingEnabled()
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin",
            "/login",
            "/account",
            "/api/admin/",
            "/api/auth/",
            "/api/member-auth/",
            "/api/cron",
            "/api/security/",
            "/api/mcp",
          ],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: siteOrigin() + "/sitemap.xml",
    host: siteOrigin(),
  };
}
