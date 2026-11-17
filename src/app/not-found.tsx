import Link from "next/link";
import { ui } from "@/lib/ui-text";
export default function NotFound() {
  return (
    <main className="public-main empty-state">
      <p className="eyebrow">404</p>
      <h1>{ui.notFound}</h1>
      <p>{ui.notFoundText}</p>
      <form action="/search" className="public-search">
        <input
          name="q"
          aria-label={ui.search}
          placeholder={ui.searchPlaceholder}
        />
        <button className="button">{ui.search}</button>
      </form>
      <Link prefetch={false} href="/">
        {ui.home} ↗
      </Link>
    </main>
  );
}
