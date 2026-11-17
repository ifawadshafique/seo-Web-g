import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { PagesManager } from "./manager";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: ui.pages,
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <AdminPage title={ui.pages} adminOnly={true}>
        <PagesManager />
      </AdminPage>
    </Suspense>
  );
}
