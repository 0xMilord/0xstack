import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <Link href="/app" className="font-semibold">
            App
          </Link>
          <div className="flex items-center gap-2">
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/app/settings">
              Settings
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
