import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { loadViewer } from "@/lib/loaders/viewer.loader";
import { signOutAction } from "@/lib/actions/auth.actions";

export async function SiteHeader() {
  const viewer = await loadViewer();
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          {process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"}
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/blog">Blog</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/about">About</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/contact">Contact</Link>
          </Button>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {viewer ? (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/orgs">App</Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/get-started">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
