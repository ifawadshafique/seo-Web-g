import Link from "next/link";
import prisma from "@/lib/prisma";
import { publishedJob } from "@/lib/saved-jobs";
import { SaveJobButton } from "./save-job-button";

export async function SavedJobsList({ memberUid }: { memberUid: string }) {
  const saved = await prisma.savedJob.findMany({
    where: { memberUid, post: publishedJob() },
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
  if (!saved.length) return <p>Your saved jobs will appear here.</p>;
  return (
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
  );
}
