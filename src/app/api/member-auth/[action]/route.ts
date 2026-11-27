import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { readToken, digest } from "@/lib/security";
import {
  firebaseStaffUser,
  firebaseStaffChallenge,
} from "@/lib/firebase-staff";
import { currentMember } from "@/lib/member-session";
import { cookieName } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, AuthError, privateHeaders } from "@/lib/auth";
import { boundedJson } from "@/lib/request-body";
import { ContentError } from "@/lib/api-error";
import { publicRateLimit } from "@/lib/rate-limit";
import {
  firebaseRequest,
  firebaseUserForToken,
  FirebaseAuthError,
} from "@/lib/firebase-auth";
import {
  memberCookie,
  memberCookieOptions,
  sealMemberToken,
} from "@/lib/member-session";
const input = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(4096),
});
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request);
    const { action } = await context.params;
    if (action === "staff") {
      const identity = await currentMember();
      const staff = identity ? await firebaseStaffUser(identity) : null;
      if (!staff || !identity)
        return NextResponse.json(
          { error: "Publishing access is not enabled for this account" },
          { status: 403, headers: privateHeaders },
        );
      if (
        !(await publicRateLimit(
          request,
          "firebase-staff-challenge",
          10,
          15 * 60000,
        ))
      )
        return NextResponse.json(
          { error: "Too many attempts" },
          { status: 429, headers: privateHeaders },
        );
      const challenge = await firebaseStaffChallenge(staff, identity);
      const response = NextResponse.json(
        { ok: true, step: challenge.step },
        { headers: privateHeaders },
      );
      response.cookies.set(cookieName, challenge.cookie, {
        ...memberCookieOptions,
        expires: challenge.expires,
      });
      return response;
    }
    if (action === "logout") {
      const raw = await readToken((await cookies()).get(cookieName)?.value);
      if (raw) await prisma.session.deleteMany({ where: { id: digest(raw) } });
      const response = NextResponse.json(
        { ok: true },
        { headers: privateHeaders },
      );
      response.cookies.set(cookieName, "", {
        ...memberCookieOptions,
        maxAge: 0,
      });
      response.cookies.set(memberCookie, "", {
        ...memberCookieOptions,
        maxAge: 0,
      });
      return response;
    }
    if (action !== "login" && action !== "register")
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: privateHeaders },
      );
    const parsed = input.safeParse(await boundedJson(request, 8192));
    if (!parsed.success) throw new FirebaseAuthError();
    const registering = action === "register";
    if (registering && parsed.data.password.length < 6)
      throw new ContentError("Use a password with at least six characters");
    const period = 15 * 60000;
    if (
      !(await publicRateLimit(request, "member-login-ip", 10, period)) ||
      !(await publicRateLimit(
        request,
        "member-login-email:" + parsed.data.email.toLowerCase(),
        5,
        period,
      ))
    )
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429, headers: { ...privateHeaders, "Retry-After": "900" } },
      );
    const result = await firebaseRequest(
      registering ? "signUp" : "signInWithPassword",
      {
        ...parsed.data,
        returnSecureToken: true,
      },
    ).catch((error: unknown) => {
      if (
        registering &&
        error instanceof FirebaseAuthError &&
        error.status === 401
      )
        throw new ContentError(
          "Could not create an account. If you already have one, sign in.",
        );
      throw error;
    });
    const identity =
      typeof result.idToken === "string"
        ? await firebaseUserForToken(result.idToken)
        : null;
    if (!identity) throw new FirebaseAuthError();
    const staff = await firebaseStaffUser(identity);
    const challenge = staff
      ? await firebaseStaffChallenge(staff, identity)
      : null;
    const response = NextResponse.json(
      { ok: true, ...(challenge ? { step: challenge.step } : {}) },
      { headers: privateHeaders },
    );
    if (challenge)
      response.cookies.set(cookieName, challenge.cookie, {
        ...memberCookieOptions,
        expires: challenge.expires,
      });
    response.cookies.set(memberCookie, await sealMemberToken(result.idToken), {
      ...memberCookieOptions,
      maxAge: 3600,
    });
    return response;
  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof ContentError ||
      error instanceof FirebaseAuthError
    )
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: privateHeaders },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400, headers: privateHeaders },
      );
    throw error;
  }
}
