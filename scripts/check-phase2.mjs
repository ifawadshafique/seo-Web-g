import "dotenv/config";
import { spawn } from "node:child_process";
const database = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(database.hostname))
  throw new Error("Use a local disposable database");
database.pathname = "/seo_phase2_test";
const env = {
  ...process.env,
  DATABASE_URL: database.toString(),
  DIRECT_URL: database.toString(),
  SITE_URL: "http://localhost:3102",
  APP_ENV: "local",
  LOCAL_AUTH_SKIP_MFA: "false",
};
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3102"],
  {
    env,
    stdio: ["ignore", "inherit", "inherit"],
  },
);
let ready = false;
try {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(env.SITE_URL + "/login");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready || server.exitCode !== null)
    throw new Error(
      "Test server did not become ready or port 3102 was already occupied",
    );
  process.exitCode = 0;
  if (process.env.CHECK_BROWSER !== "only") {
    const test = spawn(
      "./node_modules/.bin/tsx",
      ["scripts/phase2-integration.ts"],
      { env, stdio: "inherit" },
    );
    process.exitCode = await new Promise((resolve) =>
      test.on("exit", (code) => resolve(code ?? 1)),
    );
  }
  if (
    process.exitCode === 0 &&
    ["true", "only"].includes(process.env.CHECK_BROWSER)
  ) {
    const browser = spawn("node", ["scripts/phase2-browser.mjs"], {
      env,
      stdio: "inherit",
    });
    process.exitCode = await new Promise((resolve) =>
      browser.on("exit", (code) => resolve(code ?? 1)),
    );
  }
} finally {
  if (server.exitCode === null) {
    const closed = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([
      closed,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
