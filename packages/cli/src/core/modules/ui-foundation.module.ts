import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

async function patchRootLayout(projectRoot: string) {
  const layoutPath = path.join(projectRoot, "app", "layout.tsx");
  let src = await fs.readFile(layoutPath, "utf8");
  if (src.includes("0xMILORD:UI-FOUNDATION")) return;

  // Ensure Providers wrapper and header/footer render.
  // This is a best-effort patch designed for create-next-app templates.
  src = src.replace(
    /<body([^>]*)>\s*\{children\}\s*<\/body>/m,
    `<body$1>
        {/* 0xMILORD:UI-FOUNDATION */}
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
        `${m}\nimport { Providers } from "@/app/providers";\nimport { SiteHeader } from "@/lib/components/layout/site-header";\nimport { SiteFooter } from "@/lib/components/layout/site-footer";\n`
    );
  }

  await fs.writeFile(layoutPath, src, "utf8");
}

export const uiFoundationModule: Module = {
  id: "orgs",
  install: async () => {},
  activate: async (ctx) => {
    // Layout components
    await ensureDir(path.join(ctx.projectRoot, "lib", "components", "layout"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "components", "layout", "site-header.tsx"),
      `import Link from "next/link";
import { ThemeToggle } from "@/lib/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          {process.env.NEXT_PUBLIC_APP_NAME ?? "0xmilord"}
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
          <Button asChild size="sm">
            <Link href="/get-started">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "components", "layout", "site-footer.tsx"),
      `import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME ?? "0xmilord"}. All rights reserved.</p>
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
      path.join(ctx.projectRoot, "lib", "components", "layout", "theme-toggle.tsx"),
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

    await patchRootLayout(ctx.projectRoot);
  },
  validate: async () => {},
  sync: async () => {},
};

