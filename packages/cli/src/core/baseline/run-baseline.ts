import fs from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "../pipeline";
import { logger } from "../logger";
import { execCmd } from "../exec";
import { applyProfile, loadConfig, writeDefaultConfig } from "../config";
import { runModulesLifecycle } from "../modules/registry";
import { ensureApiKeysTable, ensureAssetsTable, ensureBillingTables, ensureOrgsTables } from "../generate/schema-edit";
import { runDocsSync } from "../docs/run-docs-sync";

type PackageManager = "pnpm" | "npm";

export type BaselineInput = {
  projectRoot: string;
  profile: string;
  packageManager: PackageManager;
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

async function ensureConfigRuntimeSchemaUpToDate(projectRoot: string) {
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

  // Ensure jobs/observability shapes exist (so config additions never get dropped)
  if (!next.includes("observability: z.object")) {
    next = next.replace(
      /blogMdx:\s*z\.boolean\(\),\s*\n/m,
      (m) =>
        `${m}    observability: z.object({ sentry: z.boolean(), otel: z.boolean() }).optional(),\n    jobs: z.object({ enabled: z.boolean(), driver: z.enum(["inngest", "cron-only"]) }).optional(),\n`
    );
  }

  if (next !== src) await fs.writeFile(p, next, "utf8");
}

function mkPublicPage(title: string, subtitle: string) {
  return `import Link from "next/link";
import { Button } from "@/components/ui/button";
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
          <Button asChild>
            <Link href="/get-started">Get started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">Pricing</Link>
          </Button>
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
          <Button asChild>
            <Link href="/get-started">Start now</Link>
          </Button>
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
  if (!prev || isShell) {
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
import { Button } from "@/components/ui/button";

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
            <Button asChild variant="ghost" type="button">
              <Link href={\`${otherHref}?redirect=\${encodeURIComponent(redirect)}\`}>${otherText}</Link>
            </Button>
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
import { Button } from "@/components/ui/button";

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
            <Button asChild variant="ghost" type="button">
              <Link href={"/login?redirect=" + encodeURIComponent(redirect)}>Back to sign in</Link>
            </Button>
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
import { Button } from "@/components/ui/button";

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
              <Button asChild variant="outline">
                <Link href={"/forgot-password?redirect=" + encodeURIComponent(redirect)}>Request a new link</Link>
              </Button>
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
        await writeDefaultConfig(root, path.basename(root));
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
        // Minimal v1: ensure required deps for enabled modules exist.
        // Full dependency reconciliation is handled by sync later.
        const cfg = applyProfile(await loadConfig(root), input.profile);
        const deps: string[] = [];
        const devDeps: string[] = [];

        // Always-required baseline (most already installed by init, but baseline must be safe).
        deps.push("zod", "drizzle-orm", "postgres", "better-auth", "@better-auth/drizzle-adapter");
        deps.push("@tanstack/react-query", "zustand");
        deps.push("@upstash/redis", "@upstash/ratelimit");
        // Better Auth CLI is executed via npx/pnpm dlx (no install), but keep drizzle-kit in devDeps.
        devDeps.push("drizzle-kit");

        if (cfg.modules.blogMdx) {
          deps.push("gray-matter", "next-mdx-remote", "remark-gfm", "rehype-slug", "rehype-autolink-headings");
        }
        if (cfg.modules.seo) {
          deps.push("schema-dts");
        }
        if (cfg.modules.billing === "dodo") {
          deps.push("@dodopayments/nextjs", "standardwebhooks");
        }
        if (cfg.modules.storage === "gcs") {
          deps.push("@google-cloud/storage");
        }
        if (cfg.modules.email === "resend") {
          deps.push("resend", "@react-email/components", "@react-email/render");
        }

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

        await install(Array.from(new Set(deps)), false);
        await install(Array.from(new Set(devDeps)), true);
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
      name: "generate Drizzle migration (drizzle-kit generate)",
      run: async () => {
        const cmd = pmCmd(input.packageManager);
        const args =
          input.packageManager === "npm"
            ? ["exec", "--", "drizzle-kit", "generate"]
            : ["exec", "drizzle-kit", "generate"];
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
            observability: cfg.modules.observability,
            jobs: cfg.modules.jobs,
          },
        });
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
        await runDocsSync({ projectRoot: root });
        return { kind: "ok" };
      },
    },
  ]);
}

