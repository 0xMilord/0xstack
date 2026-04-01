import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { AppShell } from "@/lib/components/layout/app-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAuth().catch(() => null);
  if (!viewer?.userId) redirect("/login?redirect=/app");
  return <AppShell>{children}</AppShell>;
}
