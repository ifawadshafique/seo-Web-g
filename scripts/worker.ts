import "dotenv/config";
// Durable tasks live in PostgreSQL; this process only supplies the local clock tick.
if (!process.env.CRON_SECRET) throw new Error("Configure CRON_SECRET");
const origin = process.env.SITE_URL ?? "http://localhost:3000";
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
async function main() {
  while (!stopped) {
    try {
      const response = await fetch(origin + "/api/cron", {
        headers: {
          "x-cron-secret": process.env.CRON_SECRET!,
          ...(process.env.STAGING_BASIC_AUTH
            ? {
                Authorization:
                  "Basic " +
                  Buffer.from(process.env.STAGING_BASIC_AUTH).toString(
                    "base64",
                  ),
              }
            : {}),
        },
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) console.error("Worker tick failed:", response.status);
    } catch {
      console.error(
        "Worker tick unavailable; pending tasks will retry after recovery.",
      );
    }
    for (let elapsed = 0; elapsed < 30000 && !stopped; elapsed += 500)
      await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
main();
