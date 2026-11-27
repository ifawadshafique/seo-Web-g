import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentMember: vi.fn(),
  findFirst: vi.fn(),
  createMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("../../../../lib/member-session", () => ({
  currentMember: mocks.currentMember,
}));
vi.mock("../../../../lib/prisma", () => ({
  default: {
    post: { findFirst: mocks.findFirst },
    savedJob: { createMany: mocks.createMany, deleteMany: mocks.deleteMany },
  },
}));
vi.mock("../../../../lib/auth", () => {
  class AuthError extends Error {}
  return {
    AuthError,
    sameOrigin: (request: Request) => {
      if (request.headers.get("origin") !== "https://workboard.example")
        throw new AuthError();
    },
    privateHeaders: { "Cache-Control": "private, no-store" },
  };
});

import { DELETE, PUT } from "./route";

const props = { params: Promise.resolve({ slug: "sample-job" }) };
const request = () =>
  new Request("https://workboard.example/api/saved-jobs/sample-job", {
    headers: { origin: "https://workboard.example" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentMember.mockResolvedValue({ uid: "member-one" });
});

describe("saved jobs", () => {
  it("rejects mutations from another origin before checking the member", async () => {
    const foreignRequest = new Request(request().url, {
      headers: { origin: "https://other.example" },
    });
    expect((await PUT(foreignRequest, props)).status).toBe(403);
    expect(mocks.currentMember).not.toHaveBeenCalled();
  });

  it("requires a signed-in member to save or remove a job", async () => {
    mocks.currentMember.mockResolvedValue(null);
    expect((await PUT(request(), props)).status).toBe(401);
    expect((await DELETE(request(), props)).status).toBe(401);
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("saves an existing public job with a duplicate-safe insert", async () => {
    mocks.findFirst.mockResolvedValue({ id: 12 });
    const response = await PUT(request(), props);
    expect(await response.json()).toEqual({ saved: true });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        slug: "sample-job",
        contentType: "JOB",
        status: "PUBLISHED",
        deletedAt: null,
      }),
      select: { id: true },
    });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [{ memberUid: "member-one", postId: 12 }],
      skipDuplicates: true,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns 404 for a job that cannot be saved", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await PUT(request(), props)).status).toBe(404);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("removes only the signed-in member’s bookmark", async () => {
    expect(await (await DELETE(request(), props)).json()).toEqual({
      saved: false,
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { memberUid: "member-one", post: { slug: "sample-job" } },
    });
  });
});
