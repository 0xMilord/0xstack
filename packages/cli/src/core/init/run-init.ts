import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { getGlobalsCss, type GlobalsTheme } from "./globals-css";
import { execCmd } from "../exec";
import { logger } from "../logger";
import { runPipeline } from "../pipeline";
import { writeDefaultConfig } from "../config";

type PackageManager = "pnpm" | "npm";

export type InitInput = {
  dir: string;
  name: string;
  packageManager: PackageManager;
  theme?: GlobalsTheme;
  features?: {
    seo: boolean;
    blogMdx: boolean;
    billing: false | "dodo";
    storage: false | "gcs";
    email?: false | "resend";
    jobs: { enabled: boolean; driver: "inngest" | "cron-only" };
    observability: { sentry: boolean; otel: boolean };
  };
};

async function ensureDirEmptyOrNew(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  const filtered = entries.filter((e) => ![".git"].includes(e));
  if (filtered.length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
}

function assertValidCreateNextAppDirName(folderName: string) {
  // create-next-app enforces npm package naming restrictions.
  // Keep this strict to avoid interactive failures later in the pipeline.
  if (folderName.startsWith("_")) {
    throw new Error(
      `Invalid project directory name "${folderName}". It cannot start with an underscore. Use e.g. "my-app".`
    );
  }
}

async function writeFileEnsured(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function ensurePnpmOnlyBuiltDependencies(projectRoot: string) {
  const pkgPath = path.join(projectRoot, "package.json");
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  } catch {
    return;
  }
  if (!raw || typeof raw !== "object") return;
  const pkg = raw as Record<string, unknown>;
  const pnpm = (pkg.pnpm ?? {}) as Record<string, unknown>;
  const onlyBuilt = pnpm.onlyBuiltDependencies;
  const list = Array.isArray(onlyBuilt) ? onlyBuilt.slice() : [];
  if (!list.includes("esbuild")) list.push("esbuild");
  pnpm.onlyBuiltDependencies = list;
  pkg.pnpm = pnpm;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function pmCmd(pm: PackageManager) {
  return pm === "npm" ? "npm" : "pnpm";
}

async function addDeps(projectRoot: string, pm: PackageManager, deps: string[], dev = false) {
  if (deps.length === 0) return;
  const cmd = pmCmd(pm);
  const args =
    pm === "npm"
      ? ["install", ...(dev ? ["-D"] : []), ...deps]
      : ["add", ...(dev ? ["-D"] : []), ...deps];
  await execCmd(cmd, args, { cwd: projectRoot });
}

export async function runInit(input: InitInput) {
  const spinner = ora();
  const targetDir = input.dir;
  const targetParent = path.dirname(targetDir);
  const targetFolder = path.basename(targetDir);
  const cwd = process.cwd();
  const initIntoCurrentDir = path.resolve(targetDir) === path.resolve(cwd);
  const tempFolderName = `.0xstack-tmp-${Date.now()}`;
  const tempDir = path.join(targetParent, tempFolderName);
  const createNextTargetFolder = initIntoCurrentDir ? tempFolderName : targetFolder;
  const effectiveDir = initIntoCurrentDir ? tempDir : targetDir;

  await runPipeline([
    {
      name: "validate target directory",
      run: async () => {
        assertValidCreateNextAppDirName(createNextTargetFolder);
        await ensureDirEmptyOrNew(targetDir);
        return { kind: "ok" };
      },
    },
    {
      name: "scaffold Next.js app (create-next-app)",
      run: async () => {
        spinner.start("Running create-next-app…");
        const args = [
          "dlx",
          "create-next-app@latest",
          createNextTargetFolder,
          "--ts",
          "--app",
          "--tailwind",
          "--eslint",
          "--no-src-dir",
          "--use-" + (input.packageManager === "npm" ? "npm" : "pnpm"),
          "--no-import-alias",
          "--yes",
          "--disable-git",
        ];
        // create-next-app runs in parent folder; it will create <targetFolder>.
        await execCmd(pmCmd(input.packageManager), args, { cwd: targetParent });
        spinner.succeed("Next.js app created");
        return { kind: "ok" };
      },
    },
    {
      name: "move scaffold into current directory (if requested)",
      run: async () => {
        if (!initIntoCurrentDir) return { kind: "skip", reason: "not initializing in current directory" };

        const src = tempDir;
        const dst = targetDir;
        const entries = await fs.readdir(src);
        for (const entry of entries) {
          await fs.rename(path.join(src, entry), path.join(dst, entry));
        }
        await fs.rmdir(src);
        return { kind: "ok" };
      },
    },
    {
      name: "normalize repo layout (flat lib/ and required pages)",
      run: async () => {
        const projectRoot = effectiveDir;
        // Ensure core dirs exist
        await fs.mkdir(path.join(projectRoot, "lib"), { recursive: true });
        await fs.mkdir(path.join(projectRoot, "content", "blog"), { recursive: true });
        await fs.mkdir(path.join(projectRoot, "drizzle", "migrations"), { recursive: true });
        await fs.mkdir(path.join(projectRoot, "drizzle", "snapshots"), { recursive: true });
        await writeFileEnsured(
          path.join(projectRoot, "drizzle.config.ts"),
          `import { defineConfig } from "drizzle-kit";
\nexport default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`
        );

        // Enforce globals.css baseline (theme selectable)
        await writeFileEnsured(path.join(projectRoot, "app", "globals.css"), getGlobalsCss(input.theme ?? "default"));

        // pnpm safety: allow required build scripts (esbuild) for common tooling.
        if (input.packageManager === "pnpm") {
          await ensurePnpmOnlyBuiltDependencies(projectRoot);
          await execCmd("pnpm", ["install"], { cwd: projectRoot });
        }

        // Install core deps required by PRD
        spinner.start("Installing baseline dependencies…");
        await addDeps(projectRoot, input.packageManager, [
          "zod",
          "drizzle-orm",
          "postgres",
          "better-auth",
          "@better-auth/drizzle-adapter",
          "@tanstack/react-query",
          "zustand",
        ]);
        await addDeps(projectRoot, input.packageManager, ["drizzle-kit"], true);
        spinner.succeed("Dependencies installed");

        // shadcn init + required components (non-interactive)
        spinner.start("Initializing shadcn/ui…");
        const dlxCmd = input.packageManager === "npm" ? "npx" : "pnpm";
        const dlxArgs = input.packageManager === "npm" ? [] : ["dlx"];
        await execCmd(
          dlxCmd,
          [...dlxArgs, "shadcn@latest", "init", "--defaults", "--yes", "--no-monorepo", "--cwd", projectRoot],
          { cwd: projectRoot }
        );
        await execCmd(
          dlxCmd,
          [
            ...dlxArgs,
            "shadcn@latest",
            "add",
            "--yes",
            "--all",
            "--cwd",
            projectRoot,
          ],
          { cwd: projectRoot }
        );
        spinner.succeed("shadcn/ui ready");

        // Re-apply globals.css theme after shadcn modifies it.
        await writeFileEnsured(path.join(projectRoot, "app", "globals.css"), getGlobalsCss(input.theme ?? "default"));

        // Public pages: real sections (hero/features/FAQ/CTA), not stubs.
        const mkSimplePage = (title: string) =>
          `export default function Page() { return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">${title}</h1></main>; }\n`;
        const mkPublicPage = (title: string, subtitle: string) => `import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="space-y-4">
        <p className="text-sm text-muted-foreground">Production-ready Next.js + Postgres starter</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="max-w-2xl text-muted-foreground">{subtitle}</p>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants({ variant: "default" })} href="/get-started">Get started</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/pricing">Pricing</Link>
        </div>
      </header>

      <Section title="Highlights">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Tiered architecture", d: "Repos → services → actions/loaders → UI, with boundary checks." },
            { t: "Security baseline", d: "Request IDs, guarded APIs, and hardened defaults from day one." },
            { t: "Enterprise modules", d: "SEO, MDX blog, billing, storage—activated only when enabled." },
          ].map((x) => (
            <Card key={x.t}>
              <CardHeader>
                <CardTitle className="text-base">{x.t}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{x.d}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="FAQ">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { q: "Is this production-ready?", a: "Yes—no placeholders. You get real wiring and migrations." },
            { q: "Can I turn modules on/off?", a: "Yes. Modules are installed but gated by config." },
            { q: "How do DB writes happen?", a: "Internal: server actions. External: versioned HTTP routes." },
            { q: "Auth IDs?", a: "Better Auth uses text IDs; schema and tables follow that." },
          ].map((x) => (
            <Card key={x.q}>
              <CardHeader>
                <CardTitle className="text-base">{x.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{x.a}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <section className="mt-10 rounded-lg border p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold">Ready to ship?</p>
            <p className="text-sm text-muted-foreground">Run init → baseline → doctor and deploy.</p>
          </div>
          <Link className={buttonVariants({ variant: "default" })} href="/get-started">Start now</Link>
        </div>
      </section>
    </main>
  );
}
`;

        await writeFileEnsured(
          path.join(projectRoot, "app", "page.tsx"),
          mkPublicPage(
            "Ship SaaS faster",
            "A starter that enforces clean boundaries, real auth, and production DB workflows from day one."
          )
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "about", "page.tsx"),
          mkPublicPage("About", "A pragmatic, enterprise-minded starter for teams that want sane defaults and strong boundaries.")
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "contact", "page.tsx"),
          mkPublicPage("Contact", "Questions, sales, or support—reach out and we’ll help you ship.")
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "pricing", "page.tsx"),
          mkPublicPage("Pricing", "Simple plans. Upgrade later—your architecture is ready from day one.")
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "terms", "page.tsx"),
          mkPublicPage("Terms", "Clear rules for using the product and service.")
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "privacy", "page.tsx"),
          mkPublicPage("Privacy", "We aim for minimal data collection and strong security defaults.")
        );
        await writeFileEnsured(path.join(projectRoot, "app", "login", "page.tsx"), mkSimplePage("Login"));
        await writeFileEnsured(
          path.join(projectRoot, "app", "get-started", "page.tsx"),
          mkPublicPage("Get started", "Configure env, run migrations, and enable modules as needed.")
        );

        // Replace create-next-app README with a real, PRD-equivalent overview (docs sync can refresh later).
        await writeFileEnsured(
          path.join(projectRoot, "README.md"),
          `# ${input.name}

Production-ready Next.js starter generated by \`0xstack\`.

## What you get
- Flat repo layout (no \`src/\`, no route groups) with all non-\`app/\` code in \`lib/\`
- Better Auth (text IDs), Drizzle ORM (Postgres), tiered architecture (repos → services → actions/loaders → UI)
- Internal writes via Server Actions; external integrations via versioned HTTP API routes (\`/api/v1/*\`)

## Getting started
\`\`\`bash
pnpm install
cp .env.example .env.local
pnpm dev
\`\`\`

## 0xstack commands
\`\`\`bash
npx 0xstack baseline --profile core
npx 0xstack doctor --profile core
npx 0xstack docs-sync
\`\`\`
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "app", "layout.tsx"),
          `import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { AppShell } from "@/lib/components/layout/app-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAuth().catch(() => null);
  if (!viewer?.userId) redirect("/login?redirect=/app");
  return <AppShell>{children}</AppShell>;
}
`
        );
        await writeFileEnsured(path.join(projectRoot, "app", "app", "page.tsx"), mkSimplePage("App"));
        await writeFileEnsured(path.join(projectRoot, "app", "app", "settings", "page.tsx"), mkSimplePage("Settings"));

        // Seed config + minimal config runtime helper path.
        await writeDefaultConfig(projectRoot, input.name, input.features);
        await writeFileEnsured(
          path.join(projectRoot, "lib", "0xstack", "config.ts"),
          `import { z } from "zod";
\nconst ConfigSchema = z.object({
  app: z.object({ name: z.string(), baseUrl: z.string().url() }),
  modules: z.object({
    orgs: z.boolean(),
    billing: z.union([z.literal(false), z.literal("dodo")]),
    storage: z.union([z.literal(false), z.literal("gcs")]),
    email: z.union([z.literal(false), z.literal("resend")]),
    seo: z.boolean(),
    blogMdx: z.boolean(),
  }),
  profiles: z.record(z.string(), z.any()).optional(),
});
\nexport function defineConfig<T extends z.input<typeof ConfigSchema>>(config: T) {
  return ConfigSchema.parse(config);
}
`
        );

        // Env schema (fail-fast) aligned with Better Auth + DB wiring
        await writeFileEnsured(
          path.join(projectRoot, "lib", "env", "schema.ts"),
          `import { z } from "zod";
\nimport { BillingEnvSchema } from "./billing";
\nimport { StorageEnvSchema } from "./storage";
\nexport const EnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  API_KEY: z.string().min(10).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
}).and(BillingEnvSchema.partial()).and(StorageEnvSchema.partial());
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "env", "server.ts"),
          `import { EnvSchema } from "./schema";
\nexport const env = EnvSchema.parse(process.env);
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "env", "billing.ts"),
          `import { z } from "zod";
\nexport const BillingEnvSchema = z.object({
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]),
  DODO_PAYMENTS_RETURN_URL: z.string().url(),
});
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "env", "storage.ts"),
          `import { z } from "zod";
\nexport const StorageEnvSchema = z.object({
  GCS_BUCKET: z.string().min(1),
  GCS_PROJECT_ID: z.string().min(1),
});
`
        );
        await writeFileEnsured(
          path.join(projectRoot, ".env.example"),
          `NEXT_PUBLIC_APP_URL="http://localhost:3000"\nBETTER_AUTH_URL="http://localhost:3000"\nBETTER_AUTH_SECRET="change-me-to-32+chars................................"\nDATABASE_URL="postgres://..."\n`
        );

        // DB + Drizzle wiring (production-grade)
        await writeFileEnsured(
          path.join(projectRoot, "lib", "db", "index.ts"),
          `import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env/server";
import * as schema from "./schema";

const client = postgres(env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "db", "schema.ts"),
          `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Better Auth core tables are generated via Better Auth CLI in baseline (no hand-rolled auth tables).
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  avatarAssetId: text("avatar_asset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
`
        );

        // Better Auth instance + handler (App Router)
        await writeFileEnsured(
          path.join(projectRoot, "lib", "auth", "auth.ts"),
          `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { env } from "@/lib/env/server";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
});
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "auth", "server.ts"),
          `import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";

export type Viewer = { userId: string } | null;

export const getViewer = cache(async (): Promise<Viewer> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const userId = session?.user?.id;
  return userId ? { userId } : null;
});

export async function requireAuth(): Promise<{ userId: string }> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Unauthorized");
  return viewer;
}
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "app", "api", "auth", "[...all]", "route.ts"),
          `import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
`
        );

        // Minimal AppShell (real component)
        await writeFileEnsured(
          path.join(projectRoot, "lib", "components", "layout", "app-shell.tsx"),
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
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/app/settings">Settings</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
`
        );

        // Security subsystem + Next.js proxy.ts (PRD-required)
        await writeFileEnsured(
          path.join(projectRoot, "lib", "security", "request-id.ts"),
          `import crypto from "node:crypto";

export function getOrCreateRequestId(headerValue: string | null): string {
  if (headerValue && headerValue.length >= 8) return headerValue;
  return crypto.randomUUID();
}
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "security", "headers.ts"),
          `export function applySecurityHeaders(headers: Headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "lib", "security", "csp.ts"),
          `export function buildCsp() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
`
        );
        await writeFileEnsured(
          path.join(projectRoot, "proxy.ts"),
          `import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { buildCsp } from "@/lib/security/csp";
import { getOrCreateRequestId } from "@/lib/security/request-id";

export function proxy(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get("x-request-id"));
  const response = NextResponse.next();

  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response.headers);
  response.headers.set("Content-Security-Policy", buildCsp());

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
`
        );

        logger.success(`Initialized app at ${projectRoot}`);
        return { kind: "ok" };
      },
    },
  ]);
}

