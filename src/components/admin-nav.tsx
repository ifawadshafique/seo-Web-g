import Link from "next/link";
import { ui } from "@/lib/ui-text";
export function AdminNav({ role }: { role: string }) {
  return (
    <nav className="admin-nav" aria-label="Administration">
      <Link prefetch={false} href="/admin">
        {ui.dashboard}
      </Link>
      <Link prefetch={false} href="/admin/posts">
        {ui.posts}
      </Link>
      <Link prefetch={false} href="/admin/taxonomy">
        {ui.taxonomy}
      </Link>
      {role === "ADMIN" && (
        <>
          <Link prefetch={false} href="/admin/moderation">
            Listing moderation
          </Link>
          <Link prefetch={false} href="/admin/search-health">
            Search & security
          </Link>
          <Link prefetch={false} href="/admin/ads">
            Advertising & consent
          </Link>
          <Link prefetch={false} href="/admin/settings">
            {ui.settings}
          </Link>
          <Link prefetch={false} href="/admin/pages">
            {ui.pages}
          </Link>
          <Link prefetch={false} href="/admin/inbox">
            {ui.inbox}
          </Link>
        </>
      )}
      <Link prefetch={false} href="/">
        {ui.viewSite} ↗
      </Link>
    </nav>
  );
}
