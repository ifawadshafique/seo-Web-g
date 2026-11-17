import { protectedRoute } from "@/lib/auth";
import { siteSettings } from "@/lib/settings";
export async function GET(request: Request) {
  return protectedRoute(request, "content", async () =>
    Response.json({ timezone: (await siteSettings()).site_timezone }),
  );
}
