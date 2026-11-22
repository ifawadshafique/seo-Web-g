import Link from "next/link";
import { firebaseConfigured } from "@/lib/firebase-auth";
import { MemberForm } from "../user-form";
export const metadata = {
  title: "User sign-in",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <h1 className="text-3xl font-bold">User sign-in</h1>
      <p className="my-4">Sign in with your email and password.</p>
      {firebaseConfigured() ? (
        <MemberForm />
      ) : (
        <p>User sign-in is not available yet.</p>
      )}
      <p className="my-6">
        <Link prefetch={false} href="/">
          Back to jobs
        </Link>
      </p>
    </main>
  );
}
