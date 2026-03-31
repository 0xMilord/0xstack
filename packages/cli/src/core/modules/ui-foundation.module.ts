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
  install: async () => {},
  activate: async (ctx) => {
    // Layout components
    await ensureDir(path.join(ctx.projectRoot, "components", "layout"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "layout", "site-header.tsx"),
      `import Link from "next/link";
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "layout", "site-footer.tsx"),
      `import Link from "next/link";

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

    await ensureDir(path.join(ctx.projectRoot, "app", "app", "settings"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "settings", "page.tsx"),
      `import Link from "next/link";
import { loadViewer } from "@/lib/loaders/viewer.loader";
import { Button } from "@/components/ui/button";
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
            <Button asChild variant="secondary">
              <Link href="/app/orgs">Organizations</Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" disabled={!viewer}>
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing & storage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="secondary">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/assets">Assets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
`
    );

    await patchRootLayout(ctx.projectRoot);
  },
  validate: async () => {},
  sync: async () => {},
};

