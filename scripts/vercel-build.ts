import "dotenv/config";
import { spawnSync } from "node:child_process";
import { stagingProblems } from "../src/lib/staging";

// This build entry is for the dedicated staging project, not the launch project.
const problems = stagingProblems(process.env);
if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production")
  problems.push(
    "Use the dedicated staging project's Production target for its scheduler; previews need separate database configuration",
  );
if (problems.length) {
  console.error(
    "Staging preflight failed before migrations:\n" +
      problems.map((problem) => "- " + problem).join("\n"),
  );
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(
    "PASS: staging configuration preflight. No database was contacted.",
  );
  process.exit(0);
}
for (const [file, ...args] of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["node_modules/next/dist/bin/next", "build"],
]) {
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("Deployment subprocess could not start");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
