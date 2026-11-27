import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({
  description,
  backHref = "/search",
  backLabel = "Back to jobs",
  children,
}: {
  description: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="member-auth-page">
      <div className="member-auth-layout">
        <div className="member-auth-brand">
          <Link href="/" className="member-auth-logo">
            <Image
              src="/workboard-logo-transparent.webp"
              alt="Workboard home"
              width={560}
              height={108}
              unoptimized
            />
          </Link>
          <p>{description}</p>
        </div>
        <div className="member-auth-card">{children}</div>
        <nav className="member-auth-links" aria-label="Sign-in page links">
          <Link prefetch={false} href={backHref}>
            {backLabel}
          </Link>
          <Link prefetch={false} href="/privacy-policy">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </main>
  );
}
