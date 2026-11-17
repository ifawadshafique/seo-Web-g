import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { SettingsManager } from "./manager";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: ui.settings,
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <AdminPage title={ui.settings} adminOnly={true}>
        <SettingsManager />
      </AdminPage>
    </Suspense>
  );
}
