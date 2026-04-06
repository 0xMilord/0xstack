import fs from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "../pipeline";
import { logger } from "../logger";
import { execCmd } from "../exec";
import { applyProfile, loadConfig, writeDefaultConfig } from "../config";
import { expectedDepsForConfig } from "../deps";
import { runModulesLifecycle } from "../modules/registry";
import { ensureApiKeysTable, ensureAssetsTable, ensureBillingTables, ensureOrgsTables } from "../generate/schema-edit";
import { runDocsSync } from "../docs/run-docs-sync";

type PackageManager = "pnpm" | "npm";

export type BaselineInput = {
  projectRoot: string;
  profile: string;
  packageManager: PackageManager;
  /** When true, skip `pnpm add` / `npm install` (e.g. integration tests in temp dirs). */
  skipPackageInstall?: boolean;
};

function pmCmd(pm: PackageManager) {
  return pm === "npm" ? "npm" : "pnpm";
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeFileEnsured(p: string, content: string) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, content, "utf8");
}

async function patchEslintConfigForOxstack(root: string) {
  const boundaryFile = "eslint.0xstack-boundaries.mjs";
  const boundaryPath = path.join(root, boundaryFile);
  if (!(await fileExists(boundaryPath))) return;

  for (const name of ["eslint.config.mjs", "eslint.config.js"]) {
    const p = path.join(root, name);
    if (!(await fileExists(p))) continue;
    let src = await fs.readFile(p, "utf8");
    if (src.includes("eslint.0xstack-boundaries") || src.includes("oxstackBoundaries")) return;

    const importLine =
      name.endsWith(".mjs") || name.endsWith(".js")
        ? `import oxstackBoundaries from "./eslint.0xstack-boundaries.mjs";\n`
        : `import oxstackBoundaries from "./eslint.0xstack-boundaries.mjs";\n`;

    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i]!)) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, importLine.trimEnd());
    src = lines.join("\n");

    let patched = false;
    if (/export\s+default\s+defineConfig\s*\(\s*\[/m.test(src)) {
      src = src.replace(/export\s+default\s+defineConfig\s*\(\s*\[/, "export default defineConfig([...oxstackBoundaries, ");
      patched = true;
    } else if (/export\s+default\s+\[/m.test(src)) {
      src = src.replace(/export\s+default\s+\[/, "export default [...oxstackBoundaries, ");
      patched = true;
    }

    if (patched) {
      await fs.writeFile(p, src, "utf8");
      logger.info(`Patched ${name} with 0xstack ESLint architecture boundaries (PRD).`);
    } else {
      logger.warn(
        `Could not auto-patch ${name} for ESLint boundaries. Merge "./eslint.0xstack-boundaries.mjs" into export default [...] manually.`
      );
    }
    return;
  }
}

export async function ensurePrdArchitectureTooling(root: string) {
  await ensureDir(path.join(root, "lib", "services"));
  await writeFileEnsured(
    path.join(root, "lib", "services", "module-factories.ts"),
    `/**
 * Progressive activation entry points (PRD).
 * Use these instead of top-level imports from billing/storage/seo when modules may be disabled.
 */
import { getConfig } from "@/lib/0xstack/config";

function assertEnabled(ok: boolean, message: string) {
  if (!ok) throw new Error(message);
}

export async function getBillingService() {
  const cfg = await getConfig();
  assertEnabled(
    cfg.modules.billing === "dodo" || cfg.modules.billing === "stripe",
    'Billing is not enabled. Set modules.billing to "dodo" or "stripe" in 0xstack.config.ts and run npx 0xstack baseline.'
  );
  return await import("@/lib/services/billing.service");
}

export async function getStorageService() {
  const cfg = await getConfig();
  assertEnabled(
    cfg.modules.storage === "gcs" || cfg.modules.storage === "s3" || cfg.modules.storage === "supabase",
    "Storage is not enabled. Set modules.storage in 0xstack.config.ts and run npx 0xstack baseline."
  );
  return await import("@/lib/services/storage.service");
}

export async function getSeoConfig() {
  const cfg = await getConfig();
  assertEnabled(
    cfg.modules.seo === true,
    "SEO is not enabled. Set modules.seo to true in 0xstack.config.ts and run npx 0xstack baseline."
  );
  const m = await import("@/lib/seo/runtime");
  return m.getSeoRuntimeConfig();
}
`
  );

  await writeFileEnsured(
    path.join(root, "eslint.0xstack-boundaries.mjs"),
    `/** Auto-managed by 0xstack baseline — PRD architecture boundary (no-restricted-imports). */
export default [
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/repos", "@/lib/repos/*"],
              message: "Use server actions or loaders — do not import repos from app/.",
            },
            {
              group: ["@/lib/db", "@/lib/db/*"],
              message: "Do not import Drizzle/db from app/; use repos via server layers.",
            },
          ],
        },
      ],
    },
  },
];
`
  );

  await patchEslintConfigForOxstack(root);

  const vitestConfigPath = path.join(root, "vitest.config.ts");
  if (!(await fileExists(vitestConfigPath))) {
    await writeFileEnsured(
      vitestConfigPath,
      `import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
`
    );
  }

  try {
    const pkgPath = path.join(root, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as { scripts?: Record<string, string> };
    pkg.scripts = pkg.scripts ?? {};
    if (!pkg.scripts.test) pkg.scripts.test = "vitest run";
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  } catch {
    // ignore
  }
}

export async function ensureOptionalEnvSchemaStubs(root: string) {
  await ensureDir(path.join(root, "lib", "env"));
  const stubs: Array<{ file: string; exportName: string }> = [
    { file: "billing-stripe.ts", exportName: "BillingStripeEnvSchema" },
    { file: "storage-s3.ts", exportName: "StorageS3EnvSchema" },
    { file: "storage-supabase.ts", exportName: "StorageSupabaseEnvSchema" },
  ];
  for (const s of stubs) {
    const p = path.join(root, "lib", "env", s.file);
    const exists = await fileExists(p);
    if (exists) continue;
    await writeFileEnsured(p, `import { z } from "zod";\n\nexport const ${s.exportName} = z.object({});\n`);
  }
}

async function ensureKeysIndex(root: string, dirRel: "lib/query-keys" | "lib/mutation-keys") {
  const dir = path.join(root, ...dirRel.split("/"));
  await ensureDir(dir);
  const entries = await fs.readdir(dir).catch(() => []);
  const keyFiles = entries
    .filter((f) => f.endsWith(".keys.ts"))
    .filter((f) => f !== "index.ts")
    .sort((a, b) => a.localeCompare(b));
  const content =
    `// 0xstack:auto-generated\n` +
    keyFiles.map((f) => `export * from "./${f.replace(/\.ts$/, "")}";`).join("\n") +
    (keyFiles.length ? "\n" : "");
  await writeFileEnsured(path.join(dir, "index.ts"), content);
}

export async function ensureConfigRuntimeSchemaUpToDate(projectRoot: string) {
  const p = path.join(projectRoot, "lib", "0xstack", "config.ts");
  const src = await fs.readFile(p, "utf8").catch(() => "");
  if (!src) return;

  let next = src;
  // Ensure email module exists in runtime schema
  if (!next.includes('email: z.union([z.literal(false), z.literal("resend")])')) {
    next = next.replace(
      /storage:\s*z\.union\(\[z\.literal\(false\),\s*z\.literal\("gcs"\)\]\),\s*\n/m,
      (m) => `${m}    email: z.union([z.literal(false), z.literal("resend")]),\n`
    );
  }

  // Ensure pwa exists in runtime schema
  if (!next.includes("pwa: z.boolean()")) {
    next = next.replace(
      /email:\s*z\.union\(\[z\.literal\(false\),\s*z\.literal\("resend"\)\]\),\s*\n/m,
      (m) => `${m}    pwa: z.boolean().optional(),\n`
    );
  }

  // Ensure cache exists in runtime schema
  if (!next.includes("cache: z.boolean()")) {
    next = next.replace(
      /email:\s*z\.union\(\[z\.literal\(false\),\s*z\.literal\("resend"\)\]\),\s*\n/m,
      (m) => `${m}    cache: z.boolean().optional(),\n`
    );
  }

  // Ensure jobs/observability shapes exist (so config additions never get dropped)
  if (!next.includes("observability: z.object")) {
    next = next.replace(
      /blogMdx:\s*z\.boolean\(\),\s*\n/m,
      (m) =>
        `${m}    observability: z.object({ sentry: z.boolean(), otel: z.boolean() }).optional(),\n    jobs: z.object({ enabled: z.boolean(), driver: z.enum(["inngest", "cron-only"]) }).optional(),\n`
    );
  }

  if (next !== src) await fs.writeFile(p, next, "utf8");

  // Older templates: ensure runtime getConfig exists for progressive module gating in UI.
  let upgraded = await fs.readFile(p, "utf8");
  if (!upgraded.includes("export async function getConfig()")) {
    let add = "";
    if (!upgraded.includes("export type OxstackConfig")) {
      add += `\nexport type OxstackConfig = z.infer<typeof ConfigSchema>;\n`;
    }
    add += `\nexport async function getConfig(): Promise<OxstackConfig> {\n  const { default: cfg } = await import("../../../0xstack.config");\n  return cfg as OxstackConfig;\n}\n`;
    upgraded = upgraded.trimEnd() + add;
    await fs.writeFile(p, upgraded, "utf8");
  }
}

export async function ensureConfigFileKeysUpToDate(projectRoot: string) {
  const p = path.join(projectRoot, "0xstack.config.ts");
  const src = await fs.readFile(p, "utf8").catch(() => "");
  if (!src) return;

  let next = src;

  const modulesBlockMatch = next.match(/modules:\s*{\s*[\s\S]*?\n\s*},/m);
  const modulesBlock = modulesBlockMatch?.[0] ?? "";

  // Ensure modules.email exists (older apps may not have it).
  if (modulesBlock && !/\bemail:\s*/m.test(modulesBlock)) {
    if (/\bstorage:\s*/m.test(modulesBlock)) {
      next = next.replace(/(\bstorage:\s*[^\r\n]*,?\r?\n)/m, `$1    email: false,\n`);
    } else if (/\bbilling:\s*/m.test(modulesBlock)) {
      next = next.replace(/(\bbilling:\s*[^\r\n]*,?\r?\n)/m, `$1    email: false,\n`);
    } else if (/modules:\s*{\s*\r?\n/m.test(modulesBlock)) {
      next = next.replace(/(modules:\s*{\s*\r?\n)/m, `$1    email: false,\n`);
    }
  }

  // Ensure modules.pwa exists.
  if (modulesBlock && !/\bpwa:\s*/m.test(modulesBlock)) {
    if (/\bemail:\s*/m.test(modulesBlock)) {
      next = next.replace(/(\bemail:\s*[^\r\n]*,?\r?\n)/m, `$1    pwa: false,\n`);
    } else if (/\bstorage:\s*/m.test(modulesBlock)) {
      next = next.replace(/(\bstorage:\s*[^\r\n]*,?\r?\n)/m, `$1    pwa: false,\n`);
    } else if (/modules:\s*{\s*\r?\n/m.test(modulesBlock)) {
      next = next.replace(/(modules:\s*{\s*\r?\n)/m, `$1    pwa: false,\n`);
    }
  }

  // Ensure modules.cache exists.
  if (modulesBlock && !/\bcache:\s*/m.test(modulesBlock)) {
    if (/\bemail:\s*/m.test(modulesBlock)) {
      next = next.replace(/(\bemail:\s*[^\r\n]*,?\r?\n)/m, `$1    cache: true,\n`);
    } else if (/\bstorage:\s*/m.test(modulesBlock)) {
      next = next.replace(/(\bstorage:\s*[^\r\n]*,?\r?\n)/m, `$1    cache: true,\n`);
    } else if (/modules:\s*{\s*\r?\n/m.test(modulesBlock)) {
      next = next.replace(/(modules:\s*{\s*\r?\n)/m, `$1    cache: true,\n`);
    }
  }

  if (next !== src) await fs.writeFile(p, next, "utf8");
}

function mkPublicPage(title: string, subtitle: string) {
  return `import Link from "next/link";
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
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">${title}</h1>
        <p className="max-w-2xl text-muted-foreground">${subtitle}</p>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants({ variant: "default" })} href="/get-started">Get started</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/pricing">Pricing</Link>
        </div>
      </header>

      <Section title="Highlights">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Tiered architecture", d: "Repos -> services -> actions/loaders -> UI, with boundary checks." },
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
            <p className="text-sm text-muted-foreground">Run init -> baseline -> doctor and deploy.</p>
          </div>
          <Link className={buttonVariants({ variant: "default" })} href="/get-started">Start now</Link>
        </div>
      </section>
    </main>
  );
}
`;
}

async function maybeUpgradeShellPage(filePath: string, nextSrc: string) {
  const prev = await fs.readFile(filePath, "utf8").catch(() => "");
  const isShell =
    prev.trim().startsWith("export default function Page() { return <main") &&
    prev.includes("mx-auto max-w-3xl p-6") &&
    prev.includes("<h1") &&
    prev.length < 220;
  const hasBrokenTemplatePlaceholders = prev.includes("{title}") || prev.includes("{subtitle}");
  const hasOldAsChild = prev.includes("asChild");
  const hasButtonVariantsUsage = prev.includes("buttonVariants(");
  const hasButtonVariantsImport = prev.includes("buttonVariants }") || prev.includes("buttonVariants,");
  const hasBrokenButtonVariantsImport = hasButtonVariantsUsage && !hasButtonVariantsImport;
  if (!prev || isShell) {
    await writeFileEnsured(filePath, nextSrc);
  } else if (hasBrokenTemplatePlaceholders || hasOldAsChild || hasBrokenButtonVariantsImport) {
    await writeFileEnsured(filePath, nextSrc);
  }
}

async function maybeUpgradeGetStartedToSignup(filePath: string, nextSrc: string) {
  const prev = await fs.readFile(filePath, "utf8").catch(() => "");
  const looksLikeMarketingTemplate =
    prev.includes("Production-ready Next.js + Postgres starter") && prev.includes("<Section title=\"Highlights\">");
  const isShell = prev.trim().startsWith("export default function Page() { return <main");
  if (!prev || isShell || looksLikeMarketingTemplate) {
    await writeFileEnsured(filePath, nextSrc);
  }
}

function mkAuthPage(kind: "login" | "signup") {
  const title = kind === "login" ? "Welcome back" : "Create your account";
  const subtitle =
    kind === "login"
      ? "Sign in to continue to your dashboard."
      : "Start with email + password. You’ll land in Organizations after signup.";
  const submitLabel = kind === "login" ? "Sign in" : "Create account";
  const otherHref = kind === "login" ? "/get-started" : "/login";
  const otherText = kind === "login" ? "Need an account? Get started" : "Already have an account? Sign in";
  const redirectDefault = "/app/orgs";
  const op = kind === "login" ? "signIn" : "signUp";
  return `"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = useMemo(() => sp.get("redirect") ?? ${JSON.stringify(redirectDefault)}, [sp]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>${title}</CardTitle>
          <CardDescription>${subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const res =
                  ${kind === "login"
      ? `await authClient.signIn.email({ email, password, rememberMe: true });`
      : `await authClient.signUp.email({ name: name || email, email, password });`}
                if ((res as any)?.error) throw new Error((res as any).error.message ?? "Authentication failed");
                router.push(redirect);
                router.refresh();
              } catch (err: any) {
                setError(err?.message ?? "Something went wrong");
              } finally {
                setPending(false);
              }
            }}
          >
            ${kind === "signup" ? `<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" />` : ""}
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete=${kind === "login" ? `"current-password"` : `"new-password"`}
              required
              minLength={8}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : "${submitLabel}"}
            </Button>
            <Link className={buttonVariants({ variant: "ghost" })} href={\`${otherHref}?redirect=\${encodeURIComponent(redirect)}\`}>
              ${otherText}
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
`;
}

function mkForgotPasswordPage() {
  return `"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Page() {
  const sp = useSearchParams();
  const redirect = useMemo(() => sp.get("redirect") ?? "/app/orgs", [sp]);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We’ll email you a reset link if the account exists.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const origin = window.location.origin;
                const redirectTo = \`\${origin}/reset-password?redirect=\${encodeURIComponent(redirect)}\`;
                const res = await authClient.requestPasswordReset({ email, redirectTo });
                if ((res as any)?.error) throw new Error((res as any).error.message ?? "Request failed");
                setDone(true);
              } catch (err: any) {
                setError(err?.message ?? "Something went wrong");
              } finally {
                setPending(false);
              }
            }}
          >
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending || done}>
              {done ? "Email sent (if account exists)" : pending ? "Working…" : "Send reset link"}
            </Button>
            <Link className={buttonVariants({ variant: "ghost" })} href={"/login?redirect=" + encodeURIComponent(redirect)}>
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
`;
}

function mkResetPasswordPage() {
  return `"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const redirect = useMemo(() => sp.get("redirect") ?? "/app/orgs", [sp]);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Set a new password to regain access.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Missing reset token. Use the link from your email.</p>
              <Link className={buttonVariants({ variant: "outline" })} href={"/forgot-password?redirect=" + encodeURIComponent(redirect)}>
                Request a new link
              </Link>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError(null);
                try {
                  const res = await authClient.resetPassword({ newPassword, token });
                  if ((res as any)?.error) throw new Error((res as any).error.message ?? "Reset failed");
                  router.push("/login?redirect=" + encodeURIComponent(redirect));
                  router.refresh();
                } catch (err: any) {
                  setError(err?.message ?? "Something went wrong");
                } finally {
                  setPending(false);
                }
              }}
            >
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                required
                minLength={8}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : "Reset password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
`;
}

export async function runBaseline(input: BaselineInput) {
  const root = input.projectRoot;
  await runPipeline([
    {
      name: "validate project root",
      run: async () => {
        const pkg = path.join(root, "package.json");
        const appDir = path.join(root, "app");
        if (!(await fileExists(pkg)) || !(await fileExists(appDir))) {
          throw new Error(`Not a Next.js app root: ${root}`);
        }
        return { kind: "ok" };
      },
    },
    {
      name: "ensure drizzle config + folders",
      run: async () => {
        await ensureDir(path.join(root, "drizzle", "migrations"));
        await ensureDir(path.join(root, "drizzle", "snapshots"));
        const drizzleConfig = path.join(root, "drizzle.config.ts");
        if (!(await fileExists(drizzleConfig))) {
          await writeFileEnsured(
            drizzleConfig,
            `import { defineConfig } from "drizzle-kit";
\nexport default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`
          );
        }
        return { kind: "ok" };
      },
    },
    {
      name: "ensure config exists",
      run: async () => {
        await writeDefaultConfig(root, path.basename(root), "Production-ready Next.js app");
        await ensureConfigFileKeysUpToDate(root);
        return { kind: "ok" };
      },
    },
    {
      name: "ensure optional env schema stubs",
      run: async () => {
        await ensureOptionalEnvSchemaStubs(root);
        return { kind: "ok" };
      },
    },
    {
      name: "upgrade config runtime schema (lib/0xstack/config.ts)",
      run: async () => {
        await ensureConfigRuntimeSchemaUpToDate(root);
        return { kind: "ok" };
      },
    },
    {
      name: "load config + apply profile",
      run: async () => {
        const cfg = applyProfile(await loadConfig(root), input.profile);
        await writeFileEnsured(
          path.join(root, "lib", "0xstack", "state.json"),
          JSON.stringify({ appliedProfile: input.profile, modules: cfg.modules }, null, 2) + "\n"
        );
        return { kind: "ok", meta: { profile: input.profile } };
      },
    },
    {
      name: "install module deps (capability-aware)",
      run: async () => {
        if (input.skipPackageInstall) {
          logger.info("Skipping package manager install (skipPackageInstall).");
          return { kind: "ok" };
        }
        // Single source of truth: use expectedDepsForConfig() to avoid drift.
        const cfg = applyProfile(await loadConfig(root), input.profile);
        const { deps, devDeps } = expectedDepsForConfig(cfg);

        const pkgPath = path.join(root, "package.json");
        let haveDeps = new Set<string>();
        let haveDevDeps = new Set<string>();
        try {
          const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          haveDeps = new Set(Object.keys(pkg.dependencies ?? {}));
          haveDevDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
        } catch {
          // treat as empty — install everything declared
        }

        const missingProd = Array.from(new Set(deps)).filter((d) => !haveDeps.has(d));
        const missingDev = Array.from(new Set(devDeps)).filter((d) => !haveDevDeps.has(d));

        const cmd = pmCmd(input.packageManager);
        const install = async (pkgs: string[], dev: boolean) => {
          if (pkgs.length === 0) return;
          const args =
            input.packageManager === "npm"
              ? ["install", ...(dev ? ["-D"] : []), ...pkgs]
              : ["add", ...(dev ? ["-D"] : []), ...pkgs];
          logger.info(`Installing ${dev ? "dev " : ""}deps: ${pkgs.join(", ")}`);
          await execCmd(cmd, args, { cwd: root });
        };

        await install(missingProd, false);
        await install(missingDev, true);
        return { kind: "ok" };
      },
    },
    {
      name: "PRD tooling (ESLint boundaries, module factories, vitest)",
      run: async () => {
        await ensurePrdArchitectureTooling(root);
        return { kind: "ok" };
      },
    },
    {
      name: "generate Better Auth schema (auth@latest generate)",
      run: async () => {
        // Non-interactive schema generation; output into lib/auth/auth-schema.ts
        const out = path.join(root, "lib", "auth", "auth-schema.ts");
        const outCli = "./lib/auth/auth-schema.ts";
        await ensureDir(path.dirname(out));

        // Break circular dependency: ensure lib/db/schema.ts doesn't export auth-schema before generation.
        const schemaPath = path.join(root, "lib", "db", "schema.ts");
        let schemaSrc = await fs.readFile(schemaPath, "utf8");
        const marker = "// 0xstack:BETTER-AUTH-EXPORTS";
        if (schemaSrc.includes(marker)) {
          schemaSrc = schemaSrc.replace(new RegExp(`${marker}[\\s\\S]*?$`, "m"), "").trimEnd() + "\n";
          await fs.writeFile(schemaPath, schemaSrc, "utf8");
        }
        // Also remove any previous export line (older versions).
        if (schemaSrc.includes('export * from "@/lib/auth/auth-schema"')) {
          schemaSrc = schemaSrc.replace(/^\s*export \* from ["']@\/lib\/auth\/auth-schema["'];\s*$/m, "").trimEnd() + "\n";
          await fs.writeFile(schemaPath, schemaSrc, "utf8");
        }

        const cmd = input.packageManager === "npm" ? "npx" : "pnpm";
        // Prefer pnpm dlx for reliability; set small retry caps.
        const args =
          input.packageManager === "npm"
            ? ["auth@latest", "generate", "--yes", "--output", outCli, "--config", "./lib/auth/auth.ts"]
            : ["dlx", "auth@latest", "generate", "--yes", "--output", outCli, "--config", "./lib/auth/auth.ts"];
        logger.info(`Running Better Auth schema generate → ${path.relative(root, out)}`);
        await execCmd(cmd, args, {
          cwd: root,
          env: {
            ...(process.env as any),
            NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
            BETTER_AUTH_SECRET:
              process.env.BETTER_AUTH_SECRET ?? "change-me-to-32+chars................................",
            DATABASE_URL: process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/db",
            NPM_CONFIG_FETCH_RETRIES: "1",
            NPM_CONFIG_FETCH_RETRY_MINTIMEOUT: "2000",
            NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT: "5000",
          },
        });

        // Ensure db schema re-exports generated tables (merge-safe marker)
        schemaSrc = await fs.readFile(schemaPath, "utf8");
        if (!schemaSrc.includes(marker)) {
          schemaSrc = `${schemaSrc.trimEnd()}\n\n${marker}\nexport * from "../auth/auth-schema";\n`;
          await fs.writeFile(schemaPath, schemaSrc, "utf8");
        }

        return { kind: "ok" };
      },
    },
    {
      name: "ensure baseline DB tables (core + modules)",
      run: async () => {
        await ensureOrgsTables(root);
        await ensureApiKeysTable(root);
        await ensureAssetsTable(root);
        await ensureBillingTables(root);
        return { kind: "ok" };
      },
    },
    {
      name: "activate modules (routes + lib wiring)",
      run: async () => {
        const cfg = applyProfile(await loadConfig(root), input.profile);

        // Ensure base lib dirs exist (PRD subsystems)
        await ensureDir(path.join(root, "lib", "actions"));
        await ensureDir(path.join(root, "lib", "repos"));
        await ensureDir(path.join(root, "lib", "loaders"));
        await ensureDir(path.join(root, "lib", "rules"));
        await ensureDir(path.join(root, "lib", "services"));
        await ensureDir(path.join(root, "lib", "query-keys"));
        await ensureDir(path.join(root, "lib", "mutation-keys"));
        await ensureDir(path.join(root, "lib", "hooks", "client"));

        await runModulesLifecycle({
          projectRoot: root,
          profile: input.profile,
          modules: {
            seo: !!cfg.modules.seo,
            blogMdx: !!cfg.modules.blogMdx,
            billing: cfg.modules.billing,
            storage: cfg.modules.storage,
            email: cfg.modules.email,
            cache: !!cfg.modules.cache,
            pwa: !!cfg.modules.pwa,
            observability: cfg.modules.observability,
            jobs: cfg.modules.jobs,
          },
        });
        return { kind: "ok" };
      },
    },
    {
      name: "generate Drizzle migration (drizzle-kit generate)",
      run: async () => {
        const cmd = pmCmd(input.packageManager);
        // Drizzle prefixes folders with a timestamp; --name avoids random slug suffix (see drizzle-kit generate --name).
        const migrationLabel = "0xstack_baseline";
        const args =
          input.packageManager === "npm"
            ? ["exec", "--", "drizzle-kit", "generate", "--name", migrationLabel]
            : ["exec", "drizzle-kit", "generate", "--name", migrationLabel];
        await execCmd(cmd, args, { cwd: root });
        return { kind: "ok" };
      },
    },
    {
      name: "apply migrations (drizzle-kit migrate) if DATABASE_URL set",
      run: async () => {
        const hasDbUrl = !!process.env.DATABASE_URL;
        if (!hasDbUrl) return { kind: "skip", reason: "DATABASE_URL not set in environment" };
        const cmd = pmCmd(input.packageManager);
        const args =
          input.packageManager === "npm"
            ? ["exec", "--", "drizzle-kit", "migrate"]
            : ["exec", "drizzle-kit", "migrate"];
        await execCmd(cmd, args, { cwd: root, env: { DATABASE_URL: process.env.DATABASE_URL } });
        return { kind: "ok" };
      },
    },
    {
      name: "ensure query/mutation key indices",
      run: async () => {
        await ensureKeysIndex(root, "lib/query-keys");
        await ensureKeysIndex(root, "lib/mutation-keys");
        return { kind: "ok" };
      },
    },
    {
      name: "upgrade public pages (if still shell templates)",
      run: async () => {
        await maybeUpgradeShellPage(
          path.join(root, "app", "page.tsx"),
          mkPublicPage(
            "Ship SaaS faster",
            "A starter that enforces clean boundaries, real auth, and production DB workflows from day one."
          )
        );
        await maybeUpgradeShellPage(
          path.join(root, "app", "about", "page.tsx"),
          mkPublicPage("About", "A pragmatic, enterprise-minded starter for teams that want sane defaults and strong boundaries.")
        );
        await maybeUpgradeShellPage(
          path.join(root, "app", "contact", "page.tsx"),
          mkPublicPage("Contact", "Questions, sales, or support—reach out and we’ll help you ship.")
        );
        await maybeUpgradeShellPage(
          path.join(root, "app", "pricing", "page.tsx"),
          mkPublicPage("Pricing", "Simple plans. Upgrade later—your architecture is ready from day one.")
        );
        await maybeUpgradeShellPage(
          path.join(root, "app", "terms", "page.tsx"),
          mkPublicPage("Terms", "Clear rules for using the product and service.")
        );
        await maybeUpgradeShellPage(
          path.join(root, "app", "privacy", "page.tsx"),
          mkPublicPage("Privacy", "We aim for minimal data collection and strong security defaults.")
        );
        await maybeUpgradeShellPage(
          path.join(root, "app", "get-started", "page.tsx"),
          mkPublicPage("Get started", "Configure env, run migrations, and enable modules as needed.")
        );
        return { kind: "ok" };
      },
    },
    {
      name: "upgrade auth pages (login/signup UX)",
      run: async () => {
        await ensureDir(path.join(root, "lib", "auth"));
        await writeFileEnsured(
          path.join(root, "lib", "auth", "auth-client.ts"),
          `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
`
        );
        await maybeUpgradeShellPage(path.join(root, "app", "login", "page.tsx"), mkAuthPage("login"));
        await maybeUpgradeGetStartedToSignup(path.join(root, "app", "get-started", "page.tsx"), mkAuthPage("signup"));
        await ensureDir(path.join(root, "app", "forgot-password"));
        await ensureDir(path.join(root, "app", "reset-password"));
        await maybeUpgradeShellPage(path.join(root, "app", "forgot-password", "page.tsx"), mkForgotPasswordPage());
        await maybeUpgradeShellPage(path.join(root, "app", "reset-password", "page.tsx"), mkResetPasswordPage());
        return { kind: "ok" };
      },
    },
    {
      name: "generate docs (README/PRD/ARCH/ERD + lib/*/README.md)",
      run: async () => {
        await runDocsSync({ projectRoot: root, profile: input.profile });
        return { kind: "ok" };
      },
    },
  ]);
}

