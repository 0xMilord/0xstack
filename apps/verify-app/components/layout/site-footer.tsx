import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"}. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link className="hover:underline" href="/terms">Terms</Link>
          <Link className="hover:underline" href="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
