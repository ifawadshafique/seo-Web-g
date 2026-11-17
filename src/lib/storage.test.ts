import { afterEach, describe, expect, it, vi } from "vitest";
import { get, put } from "@vercel/blob";
import { loadImage, storeImage } from "./storage";
vi.mock("@vercel/blob", () => ({ get: vi.fn(), put: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("private prototype image storage", () => {
  it("stores converted images privately at their immutable application key", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("MEDIA_STORAGE", "vercel-blob");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-private-token");
    await storeImage("test.webp", Buffer.from("converted-image"));
    expect(put).toHaveBeenCalledWith(
      "media/test.webp",
      Buffer.from("converted-image"),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
      }),
    );
  });
  it("reads the private stream through the existing media authorization route", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("MEDIA_STORAGE", "vercel-blob");
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: new Response("image-content").body,
    } as Awaited<ReturnType<typeof get>>);
    expect((await loadImage("test.webp")).toString()).toBe("image-content");
    expect(get).toHaveBeenCalledWith(
      "media/test.webp",
      expect.objectContaining({ access: "private" }),
    );
  });
  it("does not treat absent private objects as successful reads", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("MEDIA_STORAGE", "vercel-blob");
    vi.mocked(get).mockResolvedValue(null);
    await expect(loadImage("missing.webp")).rejects.toThrow("Not found");
  });
});
