import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ binding: vi.fn(), user: vi.fn() }));
vi.mock("./prisma", () => ({
  default: {
    setting: { findUnique: mocks.binding },
    user: { findUnique: mocks.user },
  },
}));
import { firebaseStaffUser, firebaseStaffPasswordOnly } from "./firebase-staff";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("explicit Firebase staff binding", () => {
  it("does not grant staff access from email alone or another Firebase user ID", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
    mocks.binding.mockResolvedValue(null);
    expect(
      await firebaseStaffUser({
        uid: "unapproved-uid",
        email: "owner@example.com",
      }),
    ).toBeNull();
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.binding).toHaveBeenCalledWith({
      where: { key: "firebase_staff:test-project:unapproved-uid" },
    });
  });
  it("requires a matching provisioned Firebase-only account and preserves its database role", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
    mocks.binding.mockResolvedValue({ value: "12" });
    mocks.user.mockResolvedValue({
      id: 12,
      email: "owner@example.com",
      passwordHash: "!firebase-only",
      role: "EDITOR",
    });
    expect(
      (
        await firebaseStaffUser({
          uid: "approved-uid",
          email: "owner@example.com",
        })
      )?.role,
    ).toBe("EDITOR");
    expect(
      await firebaseStaffUser({
        uid: "approved-uid",
        email: "different@example.com",
      }),
    ).toBeNull();
    mocks.user.mockResolvedValue({
      id: 12,
      email: "owner@example.com",
      passwordHash: "existing-local-password-hash",
      role: "ADMIN",
    });
    expect(
      await firebaseStaffUser({
        uid: "approved-uid",
        email: "owner@example.com",
      }),
    ).toBeNull();
  });
});

describe("Firebase password-only policy", () => {
  it("requires explicit policy for the exact bound identity", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
    const identity = { uid: "approved", email: "owner@example.com" };
    mocks.user.mockResolvedValue({
      id: 12,
      email: identity.email,
      passwordHash: "!firebase-only",
      role: "ADMIN",
    });
    for (const value of [undefined, "false", "TRUE", "true"]) {
      mocks.binding.mockImplementation(
        async ({ where }: { where: { key: string } }) =>
          where.key === "firebase_staff:test-project:approved"
            ? { value: "12" }
            : value
              ? { value }
              : null,
      );
      expect(await firebaseStaffPasswordOnly(identity)).toBe(value === "true");
    }
    expect(
      await firebaseStaffPasswordOnly({ ...identity, uid: "unbound" }),
    ).toBe(false);
    expect(
      await firebaseStaffPasswordOnly({
        ...identity,
        email: "other@example.com",
      }),
    ).toBe(false);
  });
});
