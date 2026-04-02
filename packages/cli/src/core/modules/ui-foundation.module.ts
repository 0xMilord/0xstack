import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

async function patchRootLayout(projectRoot: string) {
  const layoutPath = path.join(projectRoot, "app", "layout.tsx");
  let src = await fs.readFile(layoutPath, "utf8");
  if (src.includes("0xstack:UI-FOUNDATION")) return;

  // Ensure Providers wrapper and header/footer render.
  // This is a best-effort patch designed for create-next-app templates.
  src = src.replace(
    /<body([^>]*)>\s*\{children\}\s*<\/body>/m,
    `<body$1>
        {/* 0xstack:UI-FOUNDATION */}
        <Providers>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </Providers>
      </body>`
  );

  // Inject imports if missing.
  if (!src.includes('from "@/app/providers"')) {
    src = src.replace(
      /import\s+"\.\/globals\.css";\s*/m,
      (m) =>
        `${m}\nimport { Providers } from "@/app/providers";\nimport { SiteHeader } from "@/components/layout/site-header";\nimport { SiteFooter } from "@/components/layout/site-footer";\n`
    );
  }

  await fs.writeFile(layoutPath, src, "utf8");
}

export const uiFoundationModule: Module = {
  id: "ui-foundation",
  install: async () => { },
  activate: async (ctx) => {
    // Layout components
    await ensureDir(path.join(ctx.projectRoot, "components", "layout"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "layout", "site-header.tsx"),
      `import Link from "next/link";
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "layout", "site-footer.tsx"),
      `import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p>© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"}. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">Powered by <Link href="https://github.com/0xmilord/0xstack" target="_blank" className="hover:underline">0xstack</Link></p>
        </div>
        <div className="flex items-center gap-4">
          <Link className="hover:underline" href="/terms">Terms</Link>
          <Link className="hover:underline" href="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "layout", "theme-toggle.tsx"),
      `"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(next)}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
`
    );

    // Back-compat re-exports (older apps imported from lib/*)
    await ensureDir(path.join(ctx.projectRoot, "lib", "components", "layout"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "components", "layout", "site-header.tsx"),
      `export * from "@/components/layout/site-header";\n`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "components", "layout", "site-footer.tsx"),
      `export * from "@/components/layout/site-footer";\n`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "components", "layout", "theme-toggle.tsx"),
      `export * from "@/components/layout/theme-toggle";\n`
    );

    // Providers: theme + react-query
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "providers.tsx"),
      `"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
`
    );

    // App shell (internal app chrome). Keep this separate from the marketing header/footer.
    await ensureDir(path.join(ctx.projectRoot, "lib", "components", "layout"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "components", "layout", "app-shell.tsx"),
      `import Link from "next/link";
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
`
    );

    await ensureDir(path.join(ctx.projectRoot, "app", "app", "settings"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "settings", "page.tsx"),
      `import Link from "next/link";
import { loadViewer } from "@/lib/loaders/viewer.loader";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/lib/actions/auth.actions";

export default async function Page() {
  const viewer = await loadViewer();
  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {viewer ? "Signed in as " + (viewer.email ?? viewer.userId) : "You are not signed in."}
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/orgs">Organizations</Link>
            <form action={signOutAction}>
              <button className={buttonVariants({ variant: "outline" })} type="submit" disabled={!viewer}>
                Sign out
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing & storage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/pricing">Pricing</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/billing">Billing</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/assets">Assets</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/api-keys">API keys</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/pwa">PWA</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/webhooks">Webhooks</Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
`
    );

    // Public marketing pages (home + about/contact + legal).
    await ensureDir(path.join(ctx.projectRoot, "app", "about"));
    await ensureDir(path.join(ctx.projectRoot, "app", "contact"));
    await ensureDir(path.join(ctx.projectRoot, "app", "terms"));
    await ensureDir(path.join(ctx.projectRoot, "app", "privacy"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "page.tsx"),
      `import Link from "next/link";
import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo/metadata";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = getPageMetadata({
  title: "0xstack",
  description: "Production-ready Next.js starter: auth, orgs, billing, storage, jobs, and enterprise guardrails.",
  pathname: "/",
});

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Ship a production app in days.</h1>
          <p className="text-base text-muted-foreground">
            0xstack gives you auth, orgs, billing, storage, jobs, and enterprise guardrails with a strict CQRS contract.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className={buttonVariants({ variant: "default" })} href="/get-started">Get started</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/pricing">View pricing</Link>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What’s included</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>Better Auth + Drizzle (Postgres)</li>
              <li>Org-scoped workspace with hardened boundaries</li>
              <li>Storage (GCS) signed URLs + asset index</li>
              <li>Billing (Dodo) webhook ledger + subscription read model</li>
            </ul>
            <div className="pt-2">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/app/orgs">Open app</Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "about", "page.tsx"),
      `import Link from "next/link";
import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo/metadata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = getPageMetadata({
  title: "About",
  description: "Learn what 0xstack generates and the architectural conventions it enforces.",
  pathname: "/about",
});

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p className="text-sm text-muted-foreground">A pragmatic stack for real SaaS constraints: multi-tenant, secure, observable.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CQRS by default</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Reads use loaders + server cache; writes use server actions; external APIs call services only.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enterprise guardrails</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            ` + "`doctor`" + ` enforces boundaries and required surfaces so teams don’t accidentally break architecture.
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-2">
        <Link className={buttonVariants({ variant: "default" })} href="/contact">Contact</Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/terms">Terms</Link>
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "contact", "page.tsx"),
      `import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo/metadata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = getPageMetadata({
  title: "Contact",
  description: "Contact the team behind this app.",
  pathname: "/contact",
});

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="text-sm text-muted-foreground">Drop your support email, Discord, or a contact form here.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Update this page in your app with the channels your team actually uses (email, ticketing, chat).
        </CardContent>
      </Card>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "terms", "page.tsx"),
      `import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = getPageMetadata({
  title: "Terms",
  description: "Terms of service for this app.",
  pathname: "/terms",
});

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
      <p className="text-sm text-muted-foreground">
        Replace this with your legal terms. Keep it versioned and linked from the footer.
      </p>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "privacy", "page.tsx"),
      `import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = getPageMetadata({
  title: "Privacy",
  description: "Privacy policy for this app.",
  pathname: "/privacy",
});

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="text-sm text-muted-foreground">
        Replace this with your privacy policy. Keep it versioned and linked from the footer.
      </p>
    </main>
  );
}
`
    );

    await patchRootLayout(ctx.projectRoot);
  },
  validate: async () => { },
  sync: async () => { },
};

