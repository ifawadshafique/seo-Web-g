import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { PostList } from "./list";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: "Posts",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <AdminPage title={ui.posts}>
        <PostList />
      </AdminPage>
    </Suspense>
  );
}
