import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createCipheriv } from "node:crypto";
const run = promisify(execFile);
async function rejected(args: string[], url: string) {
  try {
    await run(
      process.execPath,
      ["scripts/recovery.mjs", "restore-drill", ...args],
      {
        env: { ...process.env, RESTORE_ADMIN_URL: url },
      },
    );
    throw new Error("Unexpected success");
  } catch (error) {
    return (error as { stderr: string }).stderr;
  }
}
describe("recovery safety boundaries", () => {
  it("rejects remote servers and connection-string host overrides before reading an archive", async () => {
    for (const url of [
      "postgresql://user:private@remote.example/db",
      "postgresql://user:private@localhost/db?host=remote.example",
    ]) {
      const error = await rejected(["missing.enc", "missing.key"], url);
      expect(error).toContain(
        "Restore drills require a local PostgreSQL server",
      );
      expect(error).not.toContain("private");
    }
  });
  it("rejects an altered authenticated archive before opening a database connection", async () => {
    const directory = await mkdtemp(join(tmpdir(), "seo-recovery-"));
    try {
      const magic = Buffer.from("SEOBACK1"),
        key = randomBytes(32),
        iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(magic);
      const body = Buffer.concat([
        cipher.update('{"version":1,"secret":"private"}'),
        cipher.final(),
      ]);
      const archive = Buffer.concat([magic, iv, cipher.getAuthTag(), body]);
      archive[archive.length - 1] ^= 1;
      await writeFile(join(directory, "backup.enc"), archive);
      await writeFile(join(directory, "backup.key"), key);
      const error = await rejected(
        [join(directory, "backup.enc"), join(directory, "backup.key")],
        "postgresql://user:private@127.0.0.1:1/db",
      );
      expect(error).toContain(
        "Recovery operation failed; source data was not modified",
      );
      expect(error).not.toContain("private");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
