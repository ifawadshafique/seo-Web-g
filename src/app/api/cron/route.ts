import { validCronSecret } from "@/lib/cron-auth";
import { runWorker } from "@/lib/worker";
import { revalidatePath } from "next/cache";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!validCronSecret(request.headers))
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const result = await runWorker();
    revalidatePath("/", "layout");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Worker failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
