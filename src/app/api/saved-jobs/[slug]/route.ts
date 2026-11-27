import { AuthError, privateHeaders, sameOrigin } from "../../../../lib/auth";
import { currentMember } from "../../../../lib/member-session";
import prisma from "../../../../lib/prisma";
import { validSavedJobSlug } from "../../../../lib/saved-job-path";
import { publishedJob } from "../../../../lib/saved-jobs";

type Props = { params: Promise<{ slug: string }> };

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

async function update(request: Request, { params }: Props, save: boolean) {
  try {
    sameOrigin(request);
  } catch (error) {
    if (error instanceof AuthError)
      return json({ error: "Invalid request" }, 403);
    throw error;
  }
  const { slug } = await params;
  if (!validSavedJobSlug(slug)) return json({ error: "Job not found" }, 404);
  const member = await currentMember();
  if (!member) return json({ error: "Sign in to save jobs" }, 401);
  if (!save) {
    await prisma.savedJob.deleteMany({
      where: { memberUid: member.uid, post: { slug } },
    });
    return json({ saved: false });
  }
  const job = await prisma.post.findFirst({
    where: { ...publishedJob(), slug },
    select: { id: true },
  });
  if (!job) return json({ error: "Job not found" }, 404);
  await prisma.savedJob.createMany({
    data: [{ memberUid: member.uid, postId: job.id }],
    skipDuplicates: true,
  });
  return json({ saved: true });
}

export function PUT(request: Request, props: Props) {
  return update(request, props, true);
}

export function DELETE(request: Request, props: Props) {
  return update(request, props, false);
}
