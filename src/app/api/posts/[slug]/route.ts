import { effectiveJobStatus } from "@/lib/content-shared";
import { cleanBody } from "@/lib/content-validation";
import prisma from "@/lib/prisma";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      deletedAt: null,
      publishedAt: { lte: new Date() },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      body: true,
      contentType: true,
      featuredMedia: true,
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      jobDetails: {
        select: {
          employerName: true,
          location: true,
          country: true,
          employmentType: true,
          closingDate: true,
          jobStatus: true,
          applicationUrl: true,
          sourceUrl: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
        },
      },
      publishedAt: true,
      updatedAt: true,
      category: true,
      author: { select: { name: true } },
    },
  });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...post, body: cleanBody(post.body), jobDetails: post.jobDetails ? {...post.jobDetails,jobStatus:effectiveJobStatus(post.jobDetails)} : null });
}
