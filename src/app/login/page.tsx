import { LoginForm } from "./form";
import { AuthLayout } from "@/components/auth-layout";
export const metadata = {
  title: "Publishing Desk sign-in",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <AuthLayout description="Manage job listings and site content.">
      <LoginForm />
    </AuthLayout>
  );
}
