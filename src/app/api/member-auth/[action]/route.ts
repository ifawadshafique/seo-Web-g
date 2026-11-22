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
    if (action === "logout") {
      const response = NextResponse.json(
        { ok: true },
        { headers: privateHeaders },
      );
      response.cookies.set(memberCookie, "", {
        ...memberCookieOptions,
        maxAge: 0,
      });
      return response;
    }
    if (action !== "login")
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: privateHeaders },
      );
    const parsed = input.safeParse(await boundedJson(request, 8192));
    if (!parsed.success) throw new FirebaseAuthError();
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
    const result = await firebaseRequest("signInWithPassword", {
      ...parsed.data,
      returnSecureToken: true,
    });
    if (
      typeof result.idToken !== "string" ||
      !(await firebaseUserForToken(result.idToken))
    )
      throw new FirebaseAuthError();
    const response = NextResponse.json(
      { ok: true },
      { headers: privateHeaders },
    );
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
