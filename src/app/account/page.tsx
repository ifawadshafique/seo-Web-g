import { firebaseStaffUser } from "@/lib/firebase-staff";
import { currentSession } from "@/lib/auth";
import Link from "next/link";
import { currentMember } from "@/lib/member-session";
import { redirect } from "next/navigation";
import { MemberForm } from "./user-form";
import { SavedJobsList } from "@/components/saved-jobs-list";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentMember();
  if (!user) redirect("/account/sign-in");
  const staff = await firebaseStaffUser(user);
  if (staff) {
    const session = await currentSession();
    if (session?.userId === staff.id) redirect("/admin");
    return (
      <main className="mx-auto w-full max-w-lg p-8">
        <h1 className="text-3xl font-bold">Publishing dashboard</h1>
        <p className="my-6">
          Complete admin verification to manage jobs, posts and settings.
        </p>
        <MemberForm staff />
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <h1 className="text-3xl font-bold">Your account</h1>
      <p className="my-6">Signed in as {user.email}</p>
      <p className="my-6">
        <Link prefetch={false} href="/">
          Browse jobs
        </Link>
      </p>
      <section className="saved-jobs-list" aria-labelledby="saved-jobs-title">
        <h2 id="saved-jobs-title" className="text-xl font-bold">
          Saved jobs
        </h2>
        <SavedJobsList memberUid={user.uid} />
      </section>
      <MemberForm logout />
    </main>
  );
}
