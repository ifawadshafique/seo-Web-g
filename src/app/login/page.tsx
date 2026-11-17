import { LoginForm } from "./form";
export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <LoginForm />
    </main>
  );
}
