import { currentMember } from "./member-session";
import { firebaseStaffUser, firebaseStaffPassword } from "./firebase-staff";
import { connection } from "next/server";
import { cookies } from "next/headers";
import prisma from "./prisma";
import { canAccess, digest, sessionValid, readToken } from "./security";
export const cookieName = "seo_session";
export async function currentSession() {
  await connection();
  const value = await readToken((await cookies()).get(cookieName)?.value);
  if (!value) return null;
  const session = await prisma.session.findUnique({
    where: { id: digest(value) },
    include: { user: true },
  });
  if (!session || !sessionValid(session, session.user)) return null;
  if (session.user.passwordHash === firebaseStaffPassword) {
    if (
      !session.mfaVerified ||
      (session.user.role === "ADMIN" && !session.user.mfaEnabled)
    )
      return null;
    const identity = await currentMember();
    if (!identity || (await firebaseStaffUser(identity))?.id !== session.userId)
      return null;
  }
  await prisma.session.updateMany({
    where: { id: session.id, lastSeenAt: session.lastSeenAt },
    data: { lastSeenAt: new Date() },
  });
  return session;
}
export class AuthError extends Error {
  constructor(public status: number) {
    super(status === 401 ? "Authentication required" : "Access denied");
  }
}
export async function authorize(
  area: Parameters<typeof canAccess>[1] = "content",
) {
  const session = await currentSession();
  if (!session) throw new AuthError(401);
  if (!canAccess(session.user.role, area)) throw new AuthError(403);
  return session;
}
export function sameOrigin(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.SITE_URL ?? "http://localhost:3000").origin
  )
    throw new AuthError(403);
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function protectedRoute(
  request: Request,
  area: Parameters<typeof canAccess>[1],
  run: (
    session: NonNullable<Awaited<ReturnType<typeof currentSession>>>,
  ) => Promise<Response>,
) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) sameOrigin(request);
    const response = await run(await authorize(area));
    Object.entries(privateHeaders).forEach(([key, value]) =>
      response.headers.set(key, value),
    );
    return response;
  } catch (error) {
    if (error instanceof AuthError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: privateHeaders },
      );
    throw error;
  }
}
