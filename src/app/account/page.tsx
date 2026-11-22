import Link from "next/link";
import { currentMember } from "@/lib/member-session";
import { redirect } from "next/navigation";
import { MemberForm } from "./user-form";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentMember();
  if (!user) redirect("/account/sign-in");
  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <h1 className="text-3xl font-bold">Your account</h1>
      <p className="my-6">Signed in as {user.email}</p>
      <p className="my-6">
        <Link prefetch={false} href="/">
          Browse jobs
        </Link>
      </p>
      <MemberForm logout />
    </main>
  );
}
