import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { loadViewer } from "@/lib/loaders/viewer.loader";
import { signOutAction } from "@/lib/actions/auth.actions";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const viewer = await loadViewer();
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          {process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"}
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/pricing">Pricing</Link>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/blog">Blog</Link>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/about">About</Link>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/contact">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {viewer ? (
            <>
              <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/app/orgs">App</Link>
              <form action={signOutAction}>
                <button className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "cursor-pointer")} type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/login">Sign in</Link>
              <Link className={buttonVariants({ variant: "default", size: "sm" })} href="/get-started">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
