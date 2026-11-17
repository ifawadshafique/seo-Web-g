import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { AdminPage } from "@/components/admin-page";
import { PostEditor } from "../editor";
import { ui } from "@/lib/ui-text";
export const metadata = {
  title: "Edit post",
  robots: { index: false, follow: false },
};
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return (
    <AdminPage title={id === "new" ? ui.newPost : ui.edit}>
      <PostEditor id={id} role={session.user.role} />
    </AdminPage>
  );
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>{ui.loading}</p>}>
      <Content {...props} />
    </Suspense>
  );
}
