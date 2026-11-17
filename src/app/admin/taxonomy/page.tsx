import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { TaxonomyManager } from "./manager";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: ui.taxonomy,
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <AdminPage title={ui.taxonomy} adminOnly={false}>
        <TaxonomyManager />
      </AdminPage>
    </Suspense>
  );
}
