import "dotenv/config";
import { Client } from "pg";
import { spawn } from "node:child_process";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(".local/recovery");
const magic = Buffer.from("SEOBACK1");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const quoted = (name) => `"${name.replaceAll('"', '""')}"`;
const maximum = 256 * 1024 * 1024;
async function command(binary, args, connection, input) {
  const url = new URL(connection);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGHOSTADDR: undefined,
    PGSERVICE: undefined,
    PGSERVICEFILE: undefined,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
    PGSSLROOTCERT:
      process.env.PGSSLROOTCERT ||
      (url.searchParams.get("sslmode")?.startsWith("verify-")
        ? "system"
        : undefined),
  };
  return new Promise((done, fail) => {
    const child = spawn(binary, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let size = 0;
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximum) {
        child.kill();
        fail(new Error("Backup exceeds prototype size limit"));
      } else chunks.push(chunk);
    });
    // Database diagnostics may contain sensitive connection or row information.
    const diagnostics = [];
    child.stderr.on("data", (chunk) => {
      if (diagnostics.reduce((n, b) => n + b.length, 0) < 65536)
        diagnostics.push(chunk);
    });
    child.on("error", () => fail(new Error(`${binary} could not start`)));
    child.on("close", async (code) => {
      if (code === 0) return done(Buffer.concat(chunks));
      try {
        await mkdir(root, { recursive: true, mode: 0o700 });
        await writeFile(
          join(root, "last-command-error.log"),
          Buffer.concat(diagnostics),
          { mode: 0o600 },
        );
      } catch {
        /* Do not expose diagnostics on failure. */
      }
      fail(
        new Error(
          `${binary} failed; private diagnostics are in .local/recovery/last-command-error.log`,
        ),
      );
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
async function inventory(db) {
  const tables = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    )
  ).rows;
  const counts = {};
  for (const { tablename } of tables)
    counts[tablename] = (
      await db.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(fingerprint, '' ORDER BY fingerprint), '')) AS fingerprint
      FROM (SELECT md5(row_to_json(t)::text) AS fingerprint FROM public.${quoted(tablename)} t) rows`)
    ).rows[0];
  return counts;
}
async function backup() {
  const connection = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connection) throw new Error("Database configuration is missing");
  const db = new Client({ connectionString: connection });
  await db.connect();
  await db.query("SET TIME ZONE 'UTC'");
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await db.query("SELECT pg_export_snapshot() AS snapshot"))
      .rows[0].snapshot;
    const counts = await inventory(db);
    const rows = (await db.query('SELECT url FROM "Media" ORDER BY id')).rows;
    const { loadImage } = await import("../src/lib/storage.ts");
    const media = [];
    let bytes = 0;
    for (const { url } of rows) {
      const key = /^\/api\/media\/([a-f0-9-]{36}\.webp)$/.exec(url)?.[1];
      if (!key) throw new Error("Unsupported media reference; backup aborted");
      const data = await loadImage(key);
      bytes += data.length;
      if (bytes > maximum / 2)
        throw new Error("Media exceeds prototype size limit");
      media.push({ key, sha256: hash(data), data: data.toString("base64") });
    }
    const dump = await command(
      process.env.PG_DUMP || "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        `--snapshot=${snapshot}`,
      ],
      connection,
    );
    const configPath = process.env.DOTENV_CONFIG_PATH || ".env";
    const config = await readFile(configPath, "utf8");
    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        counts,
        media,
        config,
        dump: dump.toString("base64"),
      }),
    );
    if (payload.length > maximum)
      throw new Error("Archive exceeds prototype size limit");
    const key = randomBytes(32),
      iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(magic);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const name = new Date().toISOString().replaceAll(":", "-");
    const keyPath = join(root, `${name}.key`),
      archive = join(root, `${name}.enc`);
    await writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
    await writeFile(
      archive,
      Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]),
      { mode: 0o600, flag: "wx" },
    );
    await db.query("COMMIT");
    console.log(
      JSON.stringify({
        archive,
        keyPath,
        tables: Object.keys(counts).length,
        media: media.length,
      }),
    );
  } finally {
    await db.end();
  }
}
async function restore(archivePath, keyPath) {
  if (!archivePath || !keyPath)
    throw new Error("Provide archive and separate key paths");
  const adminUrl = new URL(process.env.RESTORE_ADMIN_URL || "");
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(adminUrl.hostname) ||
    [...adminUrl.searchParams.keys()].some((key) => key !== "sslmode")
  )
    throw new Error("Restore drills require a local PostgreSQL server");
  const encrypted = await readFile(archivePath),
    key = await readFile(keyPath);
  if (
    encrypted.length > maximum + 36 ||
    !encrypted.subarray(0, 8).equals(magic)
  )
    throw new Error("Invalid archive");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key,
    encrypted.subarray(8, 20),
  );
  cipher.setAAD(magic);
  cipher.setAuthTag(encrypted.subarray(20, 36));
  const payload = JSON.parse(
    Buffer.concat([
      cipher.update(encrypted.subarray(36)),
      cipher.final(),
    ]).toString(),
  );
  if (payload.version !== 1) throw new Error("Unsupported archive version");
  const name = `seo_restore_${randomBytes(8).toString("hex")}`;
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${quoted(name)}`);
  } finally {
    await admin.end();
  }
  const target = new URL(adminUrl);
  target.pathname = `/${name}`;
  await command(
    process.env.PG_RESTORE || "pg_restore",
    ["--no-owner", "--no-privileges", "--exit-on-error", "--dbname", name],
    target.toString(),
    Buffer.from(payload.dump, "base64"),
  );
  const db = new Client({ connectionString: target.toString() });
  await db.connect();
  await db.query("SET TIME ZONE 'UTC'");
  const directory = join(root, name);
  try {
    const counts = await inventory(db);
    if (JSON.stringify(counts) !== JSON.stringify(payload.counts))
      throw new Error("Restored row counts differ");
    await mkdir(join(directory, "uploads"), { recursive: true, mode: 0o700 });
    const references = (await db.query('SELECT url FROM "Media" ORDER BY id'))
      .rows;
    if (references.length !== payload.media.length)
      throw new Error("Media reference counts differ");
    for (const [index, media] of payload.media.entries()) {
      if (
        !/^[a-f0-9-]{36}\.webp$/.test(media.key) ||
        references[index].url !== `/api/media/${media.key}`
      )
        throw new Error("Invalid media reference");
      const data = Buffer.from(media.data, "base64");
      if (hash(data) !== media.sha256)
        throw new Error("Media checksum mismatch");
      await writeFile(join(directory, "uploads", media.key), data, {
        mode: 0o600,
        flag: "wx",
      });
    }
    await writeFile(join(directory, "recovered.env"), payload.config, {
      mode: 0o600,
      flag: "wx",
    });
    // Copied sessions must never authenticate against a restored application.
    await db.query('DELETE FROM "Session"');
    const evidence = {
      completedAt: new Date().toISOString(),
      database: name,
      tablesVerified: Object.keys(counts).length,
      mediaVerified: references.length,
      configurationRecovered: true,
      copiedSessionsRevoked: true,
    };
    await writeFile(
      join(directory, "drill.json"),
      JSON.stringify(evidence, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await db.end();
  }
}
try {
  if (process.argv[2] === "backup") await backup();
  else if (process.argv[2] === "restore-drill")
    await restore(process.argv[3], process.argv[4]);
  else throw new Error("Use backup or restore-drill <archive> <key>");
} catch (error) {
  // Avoid leaking database errors, configuration values, or decrypted payloads.
  console.error(
    error instanceof Error &&
      /^(Restore drills|Provide archive|Use backup|Database configuration|Unsupported archive version|Unsupported media reference|Invalid archive|Media |Archive |Backup |Restored row|pg_dump|pg_restore)/.test(
        error.message,
      )
      ? error.message
      : "Recovery operation failed; source data was not modified",
  );
  process.exitCode = 1;
}
