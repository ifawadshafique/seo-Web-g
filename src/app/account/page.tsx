import { firebaseStaffUser } from "@/lib/firebase-staff";
import { currentSession } from "@/lib/auth";
import Link from "next/link";
import { currentMember } from "@/lib/member-session";
import { redirect } from "next/navigation";
import { MemberForm } from "./user-form";
import prisma from "@/lib/prisma";
import { publishedJob } from "@/lib/saved-jobs";
import { SaveJobButton } from "@/components/save-job-button";
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
  const saved = await prisma.savedJob.findMany({
    where: { memberUid: user.uid, post: publishedJob() },
    select: {
      post: {
        select: {
          slug: true,
          title: true,
          jobDetails: { select: { employerName: true } },
        },
      },
    },
    orderBy: [{ savedAt: "desc" }, { postId: "desc" }],
  });
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
        {!saved.length ? (
          <p>Your saved jobs will appear here.</p>
        ) : (
          <ul>
            {saved.map(({ post }) => (
              <li key={post.slug}>
                <div>
                  <Link href={`/${post.slug}`} prefetch={false}>
                    {post.title}
                  </Link>
                  {post.jobDetails && <p>{post.jobDetails.employerName}</p>}
                </div>
                <SaveJobButton slug={post.slug} initialSaved removeOnly />
              </li>
            ))}
          </ul>
        )}
      </section>
      <MemberForm logout />
    </main>
  );
}
