import { cookies } from "next/headers";
import { cache } from "react";
import { sealData, unsealData } from "iron-session";
import { firebaseUserForToken } from "./firebase-auth";
export const memberCookie = "jobseeker_session";
export const memberCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
export async function sealMemberToken(idToken: string) {
  return sealData(
    { firebaseIdToken: idToken },
    { password: process.env.AUTH_ENCRYPTION_KEY!, ttl: 3600 },
  );
}
export const currentMember = cache(async function () {
  const value = (await cookies()).get(memberCookie)?.value;
  if (!value || value.length > 12000) return null;
  try {
    const data = await unsealData<{ firebaseIdToken?: string }>(value, {
      password: process.env.AUTH_ENCRYPTION_KEY!,
      ttl: 3600,
    });
    return data.firebaseIdToken
      ? firebaseUserForToken(data.firebaseIdToken)
      : null;
  } catch {
    return null;
  }
});
