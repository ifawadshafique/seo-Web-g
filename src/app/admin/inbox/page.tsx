import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { InboxManager } from "./manager";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: ui.inbox,
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <AdminPage title={ui.inbox} adminOnly={true}>
        <InboxManager />
      </AdminPage>
    </Suspense>
  );
}
