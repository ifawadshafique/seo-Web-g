import { PublicFrame } from "@/components/public-frame";
export default function Layout({ children }: { children: React.ReactNode }) {
  // These pages are fully dynamic. Keep their first HTML response visible
  // instead of hiding the entire document behind a streamed loading shell.
  return <PublicFrame>{children}</PublicFrame>;
}
