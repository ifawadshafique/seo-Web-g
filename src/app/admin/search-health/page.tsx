import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { SearchHealth } from "./manager";
export const metadata = {
  title: "Search and security",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AdminPage title="Search & security" adminOnly>
        <SearchHealth />
      </AdminPage>
    </Suspense>
  );
}
