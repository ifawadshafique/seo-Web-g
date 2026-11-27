import Link from "next/link";
import { redirect } from "next/navigation";
import { currentMember } from "@/lib/member-session";
import { SavedJobsList } from "@/components/saved-jobs-list";

export const metadata = {
  title: "Saved jobs",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const member = await currentMember();
  if (!member) redirect("/account/sign-in");
  return (
    <main className="public-main static-page">
      <h1>Saved jobs</h1>
      <div className="saved-jobs-list">
        <SavedJobsList memberUid={member.uid} />
      </div>
      <Link className="button secondary" href="/search">
        Browse jobs
      </Link>
    </main>
  );
}
