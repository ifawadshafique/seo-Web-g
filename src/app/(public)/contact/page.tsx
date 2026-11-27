import { pageMetadata } from "@/lib/seo";
import { connection } from "next/server";
import prisma from "@/lib/prisma";
import { cleanBody } from "@/lib/content-validation";
import { ui } from "@/lib/ui-text";
import { ContactForm } from "./form";

export async function generateMetadata() {
  return pageMetadata({
    title: "Contact",
    description: ui.contactIntro,
    path: "/contact",
  });
}
export default async function Page() {
  await connection();
  const page = await prisma.page.findFirst({
    where: { slug: "contact", status: "PUBLISHED" },
  });
  return (
    <main className="public-main static-page">
      <h1>{page?.title ?? ui.contact}</h1>
      {page ? (
        <div
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: cleanBody(page.body) }}
        />
      ) : (
        <p>{ui.contactIntro}</p>
      )}
      <section aria-labelledby="post-a-job">
        <h2 id="post-a-job">Want to post a job?</h2>
        <p>
          Use the form below to send the job title, company name, location or
          remote status, job description, application instructions, and any
          closing date. We’ll review the details before posting the job.
        </p>
      </section>
      <ContactForm />
    </main>
  );
}
