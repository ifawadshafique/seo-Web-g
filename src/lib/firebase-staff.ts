import prisma from "./prisma";
import { token, digest, sealToken } from "./security";
export const firebaseStaffPassword = "!firebase-only";
export function firebaseStaffKey(uid: string) {
  return `firebase_staff:${process.env.FIREBASE_PROJECT_ID}:${uid}`;
}
export async function firebaseStaffUser(identity: {
  uid: string;
  email: string;
}) {
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  const binding = await prisma.setting.findUnique({
    where: { key: firebaseStaffKey(identity.uid) },
  });
  const id = Number(binding?.value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  return user &&
    user.passwordHash === firebaseStaffPassword &&
    user.email.toLowerCase() === identity.email.toLowerCase() &&
    ["ADMIN", "EDITOR"].includes(user.role)
    ? user
    : null;
}
export function firebaseStaffPasswordOnlyKey(uid: string) {
  return `firebase_staff_password_only:${process.env.FIREBASE_PROJECT_ID}:${uid}`;
}
export async function firebaseStaffPasswordOnly(identity: {
  uid: string;
  email: string;
}) {
  if (!(await firebaseStaffUser(identity))) return false;
  const policy = await prisma.setting.findUnique({
    where: { key: firebaseStaffPasswordOnlyKey(identity.uid) },
  });
  return policy?.value === "true";
}
export async function firebaseStaffChallenge(
  user: {
    id: number;
    sessionVersion: number;
    mfaEnabled: boolean;
  },
  identity: { uid: string; email: string },
) {
  const passwordOnly = await firebaseStaffPasswordOnly(identity);
  const raw = token(),
    expires = new Date(Date.now() + (passwordOnly ? 12 * 3600000 : 5 * 60000));
  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        id: digest(raw),
        userId: user.id,
        version: user.sessionVersion,
        mfaVerified: false,
        expiresAt: expires,
      },
    });
    if (passwordOnly)
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: passwordOnly
          ? "FIREBASE_STAFF_PASSWORD_ONLY_LOGIN"
          : "FIREBASE_STAFF_PASSWORD_LOGIN",
        entityType: "User",
        entityId: user.id,
      },
    });
  });
  return {
    step: passwordOnly ? "done" : user.mfaEnabled ? "verify" : "enroll",
    cookie: await sealToken(raw),
    expires,
  };
}
