import Link from "next/link";
import { Suspense } from "react";
import { currentSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { SessionButtons } from "./session-buttons";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: "Publishing overview",
  robots: { index: false, follow: false },
};
async function Dashboard() {
  const session = await currentSession();
  if (!session) redirect("/login");
  const [total, drafts, scheduled, published, events] = await Promise.all([
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.post.count({ where: { deletedAt: null, status: "DRAFT" } }),
    prisma.post.count({ where: { deletedAt: null, status: "SCHEDULED" } }),
    prisma.post.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    session.user.role === "ADMIN"
      ? prisma.auditLog.findMany({
          take: 15,
          orderBy: { createdAt: "desc" },
          select: { id: true, action: true, entityType: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  return (
    <AdminPage title={ui.dashboard}>
      <section className="welcome-banner">
        <div>
          <p className="eyebrow">Your publishing desk</p>
          <h2>Good stories. Clear opportunities.</h2>
          <p>{ui.publishingTip}</p>
        </div>
        <Link prefetch={false} href="/admin/posts/new" className="button">
          + {ui.newPost}
        </Link>
      </section>
      <div className="stats-grid">
        {[
          [ui.posts, total],
          ["Drafts", drafts],
          ["Scheduled", scheduled],
          ["Published", published],
        ].map(([label, value]) => (
          <section className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
      <div className="settings-layout">
        <section className="panel">
          <h2>Start publishing</h2>
          <div className="quick-links">
            <Link prefetch={false} href="/admin/posts/new">
              {ui.newPost} ↗
            </Link>
            <Link prefetch={false} href="/admin/posts">
              {ui.posts} ↗
            </Link>
            <Link prefetch={false} href="/admin/taxonomy">
              {ui.taxonomy} ↗
            </Link>
            {session.user.role === "ADMIN" && (
              <>
                <Link prefetch={false} href="/admin/pages">
                  {ui.pages} ↗
                </Link>
                <Link prefetch={false} href="/admin/inbox">
                  {ui.inbox} ↗
                </Link>
              </>
            )}
          </div>
          <h2>Account security</h2>
          <SessionButtons />
        </section>
        {session.user.role === "ADMIN" && (
          <section className="panel">
            <h2>Recent activity</h2>
            <ul className="activity-list">
              {events.map((event) => (
                <li key={event.id}>
                  <span>{event.action.replaceAll("_", " ").toLowerCase()}</span>
                  <small>
                    {event.entityType} ·{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: process.env.SITE_TIMEZONE ?? "Asia/Karachi",
                    }).format(event.createdAt)}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AdminPage>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <Dashboard />
    </Suspense>
  );
}
