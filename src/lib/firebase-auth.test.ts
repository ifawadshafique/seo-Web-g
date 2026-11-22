import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  firebaseRequest,
  firebaseUserForToken,
  FirebaseAuthError,
} from "./firebase-auth";
const now = () => Math.floor(Date.now() / 1000);
function token(change = {}) {
  const payload = {
    aud: "jobs-test",
    iss: "https://securetoken.google.com/jobs-test",
    sub: "member-one",
    exp: now() + 3600,
    iat: now() - 1,
    auth_time: now() - 1,
    ...change,
  };
  return (
    "header." +
    Buffer.from(JSON.stringify(payload)).toString("base64url") +
    ".signature"
  );
}
beforeEach(() => {
  vi.stubEnv("FIREBASE_PROJECT_ID", "jobs-test");
  vi.stubEnv("FIREBASE_API_KEY", "test-api-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Firebase member authentication boundary", () => {
  it("rejects wrong-project, expired and malformed tokens before contacting Google", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const value of [
      "garbage",
      token({ aud: "another-project" }),
      token({ iss: "https://attacker.example" }),
      token({ exp: now() - 1 }),
      token({ sub: "" }),
      token({ auth_time: now() + 300 }),
    ])
      expect(await firebaseUserForToken(value)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires successful Google validation and a matching enabled account", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          users: [
            {
              localId: "member-one",
              email: "member@example.com",
              emailVerified: false,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await firebaseUserForToken(token())).toEqual({
      uid: "member-one",
      email: "member@example.com",
      emailVerified: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("accounts:lookup"),
      expect.objectContaining({ redirect: "error", cache: "no-store" }),
    );
    for (const user of [
      { localId: "other-user", email: "member@example.com" },
      { localId: "member-one", email: "member@example.com", disabled: true },
      {
        localId: "member-one",
        email: "member@example.com",
        validSince: String(now() + 1),
      },
    ]) {
      fetcher.mockResolvedValue(Response.json({ users: [user] }));
      expect(await firebaseUserForToken(token())).toBeNull();
    }
    fetcher.mockResolvedValue(
      Response.json(
        { error: { message: "INVALID_ID_TOKEN" } },
        { status: 400 },
      ),
    );
    expect(await firebaseUserForToken(token())).toBeNull();
  });
  it("does not expose provider diagnostics or credentials on login failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "private provider diagnostics" } },
            { status: 400 },
          ),
        ),
    );
    await expect(
      firebaseRequest("signInWithPassword", {
        email: "member@example.com",
        password: "private-input",
      }),
    ).rejects.toThrow("Invalid email or password");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private-network-data")),
    );
    await expect(
      firebaseRequest("signInWithPassword", {}),
    ).rejects.toMatchObject({ status: 503 });
    expect(new FirebaseAuthError().message).not.toContain("private");
  });
});
