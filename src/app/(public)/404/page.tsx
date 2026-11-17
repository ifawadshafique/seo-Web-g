import { connection } from "next/server";
import prisma from "@/lib/prisma";
import Link from "next/link";
import NotFound from "@/app/not-found";
export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};
export default async function Page() {
  await connection();
  const terms = await prisma.category.findMany({
    take: 6,
    orderBy: { posts: { _count: "desc" } },
  });
  return (
    <>
      <NotFound />
      <nav
        className="public-main category-links"
        aria-label="Popular categories"
      >
        {terms.map((term) => (
          <Link prefetch={false} key={term.id} href={`/category/${term.slug}`}>
            {term.name}
          </Link>
        ))}
      </nav>
    </>
  );
}
