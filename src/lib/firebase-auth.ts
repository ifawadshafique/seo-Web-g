export class FirebaseAuthError extends Error {
  constructor(public status = 401) {
    super(
      status === 503
        ? "User sign-in is temporarily unavailable"
        : "Invalid email or password",
    );
  }
}
export const firebaseConfigured = () =>
  !!(process.env.FIREBASE_API_KEY && process.env.FIREBASE_PROJECT_ID);
export async function firebaseRequest(
  action: "signInWithPassword" | "lookup",
  body: object,
) {
  if (!firebaseConfigured()) throw new FirebaseAuthError(503);
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(process.env.FIREBASE_API_KEY!)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new FirebaseAuthError(
        response.status >= 500 ||
          ["API_KEY_INVALID", "OPERATION_NOT_ALLOWED"].includes(
            data.error?.message,
          )
          ? 503
          : 401,
      );
    return data;
  } catch (error) {
    if (error instanceof FirebaseAuthError) throw error;
    throw new FirebaseAuthError(503);
  }
}
export async function firebaseUserForToken(idToken: string) {
  try {
    if (idToken.length > 12000 || idToken.split(".").length !== 3) return null;
    const claims = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"),
    );
    const now = Math.floor(Date.now() / 1000),
      project = process.env.FIREBASE_PROJECT_ID;
    if (
      !project ||
      claims.aud !== project ||
      claims.iss !== `https://securetoken.google.com/${project}` ||
      typeof claims.sub !== "string" ||
      !claims.sub ||
      claims.sub.length > 128 ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      !Number.isFinite(claims.iat) ||
      claims.iat > now ||
      !Number.isFinite(claims.auth_time) ||
      claims.auth_time > now
    )
      return null;
    // Parsed claims are NOT authentication. Google validates the token before a user is returned.
    const data = await firebaseRequest("lookup", { idToken });
    const user = data.users?.find(
      (row: { localId?: string }) => row.localId === claims.sub,
    );
    if (
      !user ||
      user.disabled ||
      typeof user.email !== "string" ||
      (user.validSince && Number(user.validSince) > claims.auth_time)
    )
      return null;
    return {
      uid: user.localId as string,
      email: user.email as string,
      emailVerified: user.emailVerified === true,
    };
  } catch {
    return null;
  }
}
