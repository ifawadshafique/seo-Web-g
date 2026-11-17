import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "./admin-nav";
import { ui } from "@/lib/ui-text";
export async function AdminPage({
  children,
  title,
  adminOnly = false,
}: {
  children: React.ReactNode;
  title: string;
  adminOnly?: boolean;
}) {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (adminOnly && session.user.role !== "ADMIN") redirect("/admin");
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link prefetch={false} className="brand" href="/admin">
          {ui.brand}
          <span>Publishing desk</span>
        </Link>
        <AdminNav role={session.user.role} />
        <p className="admin-account">
          {session.user.name} · {session.user.role}
        </p>
      </aside>
      <main className="admin-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
