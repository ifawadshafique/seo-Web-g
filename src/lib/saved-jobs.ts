import { currentMember } from "./member-session";
import prisma from "./prisma";
import { publicWhere } from "./publishing";

export const publishedJob = () => ({
  ...publicWhere(),
  contentType: "JOB" as const,
});

export async function savedJobSlugs(slugs: string[]) {
  if (!slugs.length) return new Set<string>();
  const member = await currentMember();
  if (!member) return new Set<string>();
  const rows = await prisma.savedJob.findMany({
    where: { memberUid: member.uid, post: { slug: { in: slugs } } },
    select: { post: { select: { slug: true } } },
  });
  return new Set(rows.map(({ post }) => post.slug));
}
