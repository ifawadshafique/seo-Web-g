import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { currentSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { postInclude } from "@/lib/publishing";
import { PostView } from "@/components/post-view";
import { siteSettings } from "@/lib/settings";
export const metadata = {
  title: "Private preview",
  robots: { index: false, follow: false },
};
async function Preview({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentSession())) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: postInclude,
  });
  if (!post) notFound();
  return (
    <main className="public-main">
      <PostView
        post={post}
        timezone={(await siteSettings()).site_timezone}
        preview
      />
    </main>
  );
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Preview {...props} />
    </Suspense>
  );
}
