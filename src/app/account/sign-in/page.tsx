import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { firebaseConfigured } from "@/lib/firebase-auth";
import { MemberForm } from "../user-form";
import { validSavedJobSlug } from "@/lib/saved-job-path";
export const metadata = {
  title: "User sign-in",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ save?: string | string[]; mode?: string | string[] }>;
}) {
  const { save, mode } = await searchParams;
  const saveJob = validSavedJobSlug(save) ? save : undefined;
  const register = mode === "register";
  const alternative = new URLSearchParams();
  if (saveJob) alternative.set("save", saveJob);
  if (!register) alternative.set("mode", "register");
  return (
    <AuthLayout
      description="Keep the jobs you?re interested in together."
      backHref={saveJob ? "/" + saveJob : "/search"}
      backLabel={saveJob ? "Back to listing" : "Back to jobs"}
    >
      <h1>{register ? "Create your account" : "Sign in to Workboard"}</h1>
      <p className="member-auth-intro">
        {saveJob
          ? register
            ? "Create an account to save this job."
            : "Sign in to save this job."
          : register
            ? "Save jobs and come back to them on any device."
            : "Use your email and password to access your account."}
      </p>
      {firebaseConfigured() ? (
        <>
          <MemberForm
            key={register ? "register" : "login"}
            saveJob={saveJob}
            register={register}
          />
          <p className="member-auth-switch">
            {register ? "Already have an account?" : "New to Workboard?"}{" "}
            <Link
              href={
                "/account/sign-in" + (alternative.size ? "?" + alternative : "")
              }
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </>
      ) : (
        <p role="status">User sign-in is not available yet.</p>
      )}
    </AuthLayout>
  );
}
