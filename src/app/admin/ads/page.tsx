import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { AdsManager } from "./manager";
export const metadata = {
  title: "Advertising and consent",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AdminPage title="Advertising & consent" adminOnly>
        <AdsManager />
      </AdminPage>
    </Suspense>
  );
}
