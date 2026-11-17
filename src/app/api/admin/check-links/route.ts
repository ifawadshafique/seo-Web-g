import { z } from "zod";
import { protectedRoute } from "@/lib/auth";
import { contentResult } from "@/lib/api-error";
import { httpsUrl } from "@/lib/content-validation";
import { linkResponds } from "@/lib/check-links";
export async function POST(request: Request) {
  return protectedRoute(request, "content", () =>
    contentResult(async () => {
      const { urls } = z
        .object({ urls: z.array(httpsUrl).min(1).max(2) })
        .parse(await request.json());
      const results = await Promise.all(urls.map(linkResponds));
      return Response.json({
        warnings: urls
          .filter((_url, index) => !results[index])
          .map(
            (url) =>
              `This link could not be reached. Check it manually before publishing: ${url}`,
          ),
      });
    }),
  );
}
