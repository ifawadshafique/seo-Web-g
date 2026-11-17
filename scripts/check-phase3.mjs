import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { Client } from "pg";
import sharp from "sharp";
const dbUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname))
  throw new Error("Phase 3 checks require local disposable PostgreSQL");
const maintenance = new URL(dbUrl);
maintenance.pathname = "/postgres";
const db = new Client({ connectionString: maintenance.toString() });
await db.connect();
if (
  !(
    await db.query("SELECT 1 FROM pg_database WHERE datname=$1", [
      "seo_phase3_test",
    ])
  ).rowCount
)
  await db.query("CREATE DATABASE seo_phase3_test");
await db.end();
dbUrl.pathname = "/seo_phase3_test";
const env = {
  ...process.env,
  DATABASE_URL: dbUrl.toString(),
  DIRECT_URL: dbUrl.toString(),
  SITE_URL: "http://localhost:3103",
  APP_ENV: "staging",
  MEDIA_STORAGE: "s3",
  BLOB_READ_WRITE_TOKEN: "",
  STAGING_BASIC_AUTH: "phase3:local-test-only",
  LOCAL_AUTH_SKIP_MFA: "false",
  CSP_MODE: "report-only",
  CSP_STAGING_EVIDENCE: "",
  ADSENSE_APPROVED: "true",
  COOKIEBOT_TCF_ENABLED: "true",
  S3_ENDPOINT: "http://127.0.0.1:3115",
  S3_BUCKET: "phase3-test",
  S3_REGION: "us-east-1",
  S3_FORCE_PATH_STYLE: "true",
  AWS_ACCESS_KEY_ID: "local-test",
  AWS_SECRET_ACCESS_KEY: "local-test-only",
  SMTP_URL: "",
  CRON_SECRET: "phase3-local-test-cron",
};
const migration = spawnSync(
  "./node_modules/.bin/prisma",
  ["migrate", "deploy"],
  { env, stdio: "inherit" },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
const image = await sharp({
  create: { width: 1600, height: 900, channels: 3, background: "#c5d6c1" },
})
  .webp()
  .toBuffer();
const storage = createServer((request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, {
      "Content-Type": "image/webp",
      "Content-Length": image.length,
    });
    response.end(image);
  } else {
    request.resume();
    request.on("end", () => {
      response.writeHead(200);
      response.end();
    });
  }
});
await new Promise((resolve) => storage.listen(3115, "127.0.0.1", resolve));
const servers = [];
async function launch(port, overrides = {}) {
  const childEnv = {
    ...env,
    SITE_URL: `http://localhost:${port}`,
    ...overrides,
  };
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
    { env: childEnv, stdio: "inherit" },
  );
  servers.push(server);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(childEnv.SITE_URL + "/login", {
        headers: {
          Authorization:
            "Basic " + Buffer.from(env.STAGING_BASIC_AUTH).toString("base64"),
        },
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready || server.exitCode !== null)
    throw new Error("Phase 3 test server failed");
  return childEnv;
}
async function run(script, testEnv = env) {
  const child = spawn(
    script.endsWith(".mjs") ? process.execPath : "./node_modules/.bin/tsx",
    [script],
    {
      env: testEnv,
      stdio: "inherit",
    },
  );
  const code = await new Promise((resolve) =>
    child.once("exit", (code) => resolve(code ?? 1)),
  );
  if (code !== 0) throw new Error(`${script} failed`);
}
try {
  await launch(3103);
  if (
    process.env.CHECK_PHASE3 !== "browser-only" &&
    process.env.CHECK_PHASE3 !== "performance-only"
  )
    await run("scripts/phase3-integration.ts");
  await launch(3104, { APP_ENV: "production", STAGING_BASIC_AUTH: "" });
  if (process.env.CHECK_PHASE3 !== "performance-only")
    await run("scripts/phase3-browser.ts");
  if (
    process.env.CHECK_PERFORMANCE === "true" ||
    process.env.CHECK_PHASE3 === "performance-only"
  )
    await run("scripts/phase3-performance.mjs");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const server of servers) {
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
  await new Promise((resolve) => storage.close(resolve));
}
