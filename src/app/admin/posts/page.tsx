import { Suspense } from "react";
import { AdminPage } from "@/components/admin-page";
import { PostList } from "./list";
import { ui, statusLabels } from "@/lib/ui-text";
export const metadata = {
  title: "Posts",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const initialStatus =
    typeof status === "string" && Object.hasOwn(statusLabels, status)
      ? status
      : "";
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <AdminPage title={ui.posts}>
        <PostList key={initialStatus} initialStatus={initialStatus} />
      </AdminPage>
    </Suspense>
  );
}
