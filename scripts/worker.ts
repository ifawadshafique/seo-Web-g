import "dotenv/config";
import { workerRequest } from "../src/lib/worker-request";
// Durable tasks live in PostgreSQL; this process only supplies the local clock tick.
if (!process.env.CRON_SECRET) throw new Error("Configure CRON_SECRET");
workerRequest(); // Fail before entering the loop if the destination is unsafe.
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
      const { url, options } = workerRequest();
      const response = await fetch(url, options);
      if (!response.ok) console.error("Worker tick failed:", response.status);
      else {
        const result = await response.json();
        if (
          !Number.isInteger(result.published) ||
          !Number.isInteger(result.failed) ||
          !Number.isInteger(result.expired)
        )
          throw new Error("Invalid worker response");
        if (result.failed > 0)
          console.error(
            "Worker reported failed publication tasks:",
            result.failed,
          );
      }
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
