import { connection } from "next/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { publicWhere } from "@/lib/publishing";
import { pageMetadata } from "@/lib/seo";
import { ReportForm } from "./form";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return pageMetadata({
    title: "Report a job listing",
    description:
      "Tell the site owner about an inaccurate or suspicious job listing so it can be reviewed.",
    path: "/report/" + slug,
    index: false,
  });
}
export default async function Page({ params }: Props) {
  await connection();
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { ...publicWhere(), slug, contentType: "JOB" },
    select: { title: true },
  });
  if (!post) notFound();
  return (
    <main className="public-main static-page">
      <h1>Report this listing</h1>
      <p>{post.title}</p>
      <ReportForm slug={slug} />
    </main>
  );
}
