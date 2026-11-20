import { boundedJson } from "@/lib/request-body";
import { ContentError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  cookieName,
  currentSession,
  privateHeaders,
  sameOrigin,
  AuthError,
} from "@/lib/auth";
import {
  checkPassword,
  decrypt,
  digest,
  encrypt,
  generateSecret,
  generateURI,
  otpStep,
  token,
  verifyTotp,
  sealToken,
  readToken,
  localMfaBypass,
} from "@/lib/security";
import { z } from "zod";

const failure = () =>
  NextResponse.json(
    { error: "Invalid credentials or verification code" },
    { status: 401, headers: privateHeaders },
  );
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request);
    const { action } = await context.params;
    if (action === "login") {
      const parsed = z
        .object({
          email: z.string().email().max(254),
          password: z.string().min(1).max(72),
        })
        .safeParse(await boundedJson(request, 4096));
      if (!parsed.success) return failure();
      const email = parsed.data.email.trim().toLowerCase();
      // Persisted, atomic fixed-window limits. Only trust a proxy header when the deployment explicitly configures it.
      const ip =
        process.env.TRUST_PROXY === "true"
          ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown")
          : "local";
      const window = Math.floor(Date.now() / 900000);
      const counts = await prisma.$transaction(
        [email, `ip:${ip}`].map((value) =>
          prisma.loginBucket.upsert({
            where: { key: digest(`${value}:${window}`) },
            create: {
              key: digest(`${value}:${window}`),
              expiresAt: new Date((window + 1) * 900000),
            },
            update: { count: { increment: 1 } },
          }),
        ),
      );
      if (counts.some((bucket) => bucket.count > 5))
        return NextResponse.json(
          { error: "Too many attempts. Try again in 15 minutes." },
          { status: 429, headers: { ...privateHeaders, "Retry-After": "900" } },
        );
      const user = await prisma.user.findUnique({ where: { email } });
      const dummy =
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const valid = await checkPassword(
        parsed.data.password,
        user?.passwordHash ?? dummy,
      );
      if (!user || !valid) return failure();
      const value = token();
      const bypass = localMfaBypass();
      const session = await prisma.$transaction(async (tx) => {
        const created = await tx.session.create({
          data: {
            id: digest(value),
            userId: user.id,
            version: user.sessionVersion,
            // Remains unverified so disabling the local setting invalidates this session.
            mfaVerified: false,
            expiresAt: new Date(
              Date.now() + (bypass ? 12 * 3600000 : 5 * 60000),
            ),
          },
        });
        if (bypass) {
          await tx.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "LOCAL_PASSWORD_LOGIN",
              entityType: "User",
              entityId: user.id,
            },
          });
        }
        return created;
      });
      const response = NextResponse.json(
        { step: bypass ? "done" : user.mfaEnabled ? "verify" : "enroll" },
        { headers: privateHeaders },
      );
      response.cookies.set(cookieName, await sealToken(value), {
        ...cookieOptions,
        expires: session.expiresAt,
      });
      return response;
    }
    const value = await readToken(request.cookies.get(cookieName)?.value);
    const session = value
      ? await prisma.session.findUnique({
          where: { id: digest(value) },
          include: { user: true },
        })
      : null;
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.version !== session.user.sessionVersion ||
      Date.now() - session.lastSeenAt.getTime() >= 1800000
    )
      return failure();
    const user = session.user;
    if (action === "enroll" && !user.mfaEnabled && !session.mfaVerified) {
      const secret = generateSecret();
      // Store an enrollment secret on this short-lived challenge, never grant access yet.
      await prisma.session.update({
        where: { id: session.id },
        data: { enrollmentSecret: encrypt(secret) },
      });
      return NextResponse.json(
        {
          secret,
          uri: generateURI({ issuer: "SEO Web", label: user.email, secret }),
        },
        { headers: privateHeaders },
      );
    }
    if (action === "verify") {
      const parsed = z
        .object({ code: z.string().min(6).max(100) })
        .safeParse(await boundedJson(request, 4096));
      if (!parsed.success || session.mfaVerified) return failure();
      const attempt = await prisma.session.update({
        where: { id: session.id },
        data: { attempts: { increment: 1 } },
      });
      if (attempt.attempts > 5) return failure();
      const stored = user.mfaEnabled
        ? user.mfaSecret
        : session.enrollmentSecret;
      if (!stored) return failure();
      const validOtp = await verifyTotp(decrypt(stored), parsed.data.code);
      const codes =
        !user.mfaEnabled && validOtp
          ? Array.from({ length: 10 }, () => token().slice(0, 24))
          : [];
      const nextToken = token();
      const now = new Date();
      const expiresAt = new Date(Date.now() + 12 * 3600000);
      try {
        await prisma.$transaction(async (tx) => {
          // Claim the challenge atomically: concurrent verification cannot create two sessions.
          const claimed = await tx.session.deleteMany({
            where: { id: session.id, mfaVerified: false },
          });
          if (claimed.count !== 1) throw new AuthError(401);
          if (validOtp) {
            const updated = await tx.user.updateMany({
              where: {
                id: user.id,
                sessionVersion: session.version,
                mfaEnabled: user.mfaEnabled,
                OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: otpStep() } }],
              },
              data: {
                mfaLastStep: otpStep(),
                mfaEnabled: true,
                mfaSecret: stored,
                lastLoginAt: now,
              },
            });
            if (updated.count !== 1) throw new AuthError(401);
          } else {
            if (!user.mfaEnabled) throw new AuthError(401);
            const recovery = await tx.recoveryCode.deleteMany({
              where: { userId: user.id, hash: digest(parsed.data.code) },
            });
            if (recovery.count !== 1) throw new AuthError(401);
            // A recovery login invalidates all other sessions.
            const recovered = await tx.user.updateMany({
              where: {
                id: user.id,
                sessionVersion: session.version,
                mfaEnabled: true,
              },
              data: { sessionVersion: { increment: 1 }, lastLoginAt: now },
            });
            if (recovered.count !== 1) throw new AuthError(401);
            await tx.session.deleteMany({ where: { userId: user.id } });
          }
          if (codes.length)
            await tx.recoveryCode.createMany({
              data: codes.map((code) => ({
                userId: user.id,
                hash: digest(code),
              })),
            });
          await tx.session.create({
            data: {
              id: digest(nextToken),
              userId: user.id,
              version: session.version + (validOtp ? 0 : 1),
              mfaVerified: true,
              expiresAt,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: codes.length
                ? "MFA_ENROLLED"
                : validOtp
                  ? "LOGIN"
                  : "RECOVERY_LOGIN",
              entityType: "User",
              entityId: user.id,
            },
          });
        });
      } catch (error) {
        if (error instanceof AuthError) return failure();
        throw error;
      }
      const response = NextResponse.json(
        { ok: true, recoveryCodes: codes },
        { headers: privateHeaders },
      );
      response.cookies.set(cookieName, await sealToken(nextToken), {
        ...cookieOptions,
        expires: expiresAt,
      });
      return response;
    }
    if (action === "logout") {
      await prisma.session.deleteMany({ where: { id: session.id } });
      const response = NextResponse.json(
        { ok: true },
        { headers: privateHeaders },
      );
      response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (action === "revoke") {
      const active = await currentSession();
      if (!active) return failure();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { sessionVersion: { increment: 1 } },
        }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
        prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "SESSIONS_REVOKED",
            entityType: "User",
            entityId: user.id,
          },
        }),
      ]);
      const response = NextResponse.json(
        { ok: true },
        { headers: privateHeaders },
      );
      response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    return NextResponse.json(
      { error: "Unknown action" },
      { status: 404, headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof AuthError || error instanceof ContentError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: privateHeaders },
      );
    if (error instanceof SyntaxError) return failure();
    throw error;
  }
}
