import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { ModerationManager } from "./manager";
export const metadata = {
  title: "Listing moderation",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AdminPage title="Listing moderation" adminOnly>
        <ModerationManager />
      </AdminPage>
    </Suspense>
  );
}
