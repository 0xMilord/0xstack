import fs from "node:fs/promises";
import path from "node:path";
import { computeProjectState } from "../project/project-state";
import { logger } from "../logger";

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(dir: string, exts: string[]) {
  const out: string[] = [];
  const walk = async (d: string) => {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
        await walk(full);
      } else if (e.isFile()) {
        if (exts.some((x) => full.endsWith(x))) out.push(full);
      }
    }
  };
  await walk(dir);
  return out;
}

export type DoctorInput = { projectRoot: string; profile: string };

export async function runDoctor(input: DoctorInput) {
  const state = await computeProjectState(input.projectRoot, input.profile);
  const modules = state.modules as any;

  const issues: string[] = [];
  const note = (msg: string) => issues.push(msg);

  const requiredFiles = ["proxy.ts", "lib/env/schema.ts", "lib/env/server.ts", "lib/db/index.ts", "lib/db/schema.ts"];
  for (const f of requiredFiles) {
    const p = path.join(input.projectRoot, f);
    if (!(await exists(p))) note(`Missing required file: ${f}`);
  }

  const checkFiles = async (label: string, files: string[]) => {
    const missing: string[] = [];
    for (const f of files) {
      if (!(await exists(path.join(input.projectRoot, f)))) missing.push(f);
    }
    if (missing.length) note(`${label}: missing ${missing.join(", ")}`);
  };

  // Env invariants (file-level, plus module-specific required keys in schema)
  const envSchemaPath = path.join(input.projectRoot, "lib/env/schema.ts");
  const envSchema = (await exists(envSchemaPath)) ? await fs.readFile(envSchemaPath, "utf8") : "";
  const requireEnvKey = (key: string) => {
    if (!envSchema.includes(key)) note(`Env schema missing required key: ${key}`);
  };
  requireEnvKey("DATABASE_URL");
  requireEnvKey("BETTER_AUTH_SECRET");
  requireEnvKey("BETTER_AUTH_URL");
  requireEnvKey("NEXT_PUBLIC_APP_URL");

  // Always-on foundations (per-layer sanity)
  await checkFiles("foundation.ui", ["app/layout.tsx", "app/providers.tsx", "app/app/layout.tsx", "app/app/settings/page.tsx"]);
  await checkFiles("foundation.auth", [
    "app/api/auth/[...all]/route.ts",
    "lib/auth/auth.ts",
    "lib/auth/auth-schema.ts",
    "lib/services/viewer.service.ts",
    "lib/loaders/viewer.loader.ts",
    "lib/actions/auth.actions.ts",
    "lib/hooks/client/use-viewer.ts",
  ]);
  await checkFiles("foundation.orgs", [
    "lib/repos/orgs.repo.ts",
    "lib/repos/org-members.repo.ts",
    "lib/services/orgs.service.ts",
    "lib/actions/orgs.actions.ts",
    "lib/loaders/orgs.loader.ts",
    "app/app/orgs/page.tsx",
  ]);
  await checkFiles("foundation.cache", ["lib/cache/config.ts", "lib/cache/server.ts", "lib/cache/revalidate.ts"]);
  await checkFiles("foundation.observability", ["lib/utils/logger.ts"]);
  await checkFiles("foundation.security", ["lib/security/api.ts", "lib/services/api-keys.service.ts", "lib/repos/api-keys.repo.ts"]);
  await checkFiles("foundation.webhook-ledger", ["lib/repos/webhook-events.repo.ts"]);

  if (modules.billing === "dodo") {
    const billingEnvPath = path.join(input.projectRoot, "lib/env/billing.ts");
    if (!(await exists(billingEnvPath))) note("Billing enabled but missing lib/env/billing.ts");
    const billingEnv = (await exists(billingEnvPath)) ? await fs.readFile(billingEnvPath, "utf8") : "";
    for (const key of ["DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_KEY", "DODO_PAYMENTS_ENVIRONMENT", "DODO_PAYMENTS_RETURN_URL"]) {
      if (!billingEnv.includes(key)) note(`Billing env schema missing key: ${key}`);
    }
    await checkFiles("billing.dodo.apis", [
      "app/api/v1/billing/checkout/route.ts",
      "app/api/v1/billing/portal/route.ts",
      "app/api/v1/billing/webhook/route.ts",
    ]);
    await checkFiles("billing.dodo.ux", ["app/pricing/page.tsx", "app/billing/success/page.tsx", "app/billing/cancel/page.tsx", "app/app/billing/page.tsx"]);
    await checkFiles("billing.dodo.core", ["lib/services/billing.service.ts", "lib/repos/billing.repo.ts"]);
  }
  if (modules.storage === "gcs") {
    const storageEnvPath = path.join(input.projectRoot, "lib/env/storage.ts");
    if (!(await exists(storageEnvPath))) note("Storage enabled but missing lib/env/storage.ts");
    const storageEnv = (await exists(storageEnvPath)) ? await fs.readFile(storageEnvPath, "utf8") : "";
    for (const key of ["GCS_BUCKET", "GCS_PROJECT_ID"]) {
      if (!storageEnv.includes(key)) note(`Storage env schema missing key: ${key}`);
    }
    await checkFiles("storage.gcs.apis", [
      "app/api/v1/storage/sign-upload/route.ts",
      "app/api/v1/storage/sign-read/route.ts",
      "app/api/v1/storage/assets/route.ts",
      "app/api/v1/storage/assets/[assetId]/route.ts",
    ]);
    await checkFiles("storage.gcs.core", ["lib/storage/gcs.ts", "lib/services/storage.service.ts", "lib/repos/assets.repo.ts"]);
    await checkFiles("storage.gcs.ui", ["app/app/assets/page.tsx"]);
  }

  // Module-gated surfaces
  const mustHaveSeo = !!modules.seo;
  if (mustHaveSeo) {
    for (const f of ["app/robots.ts", "app/sitemap.ts", "lib/seo/jsonld.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) note(`SEO enabled but missing: ${f}`);
    }
    await checkFiles("seo.social-images", ["app/opengraph-image.tsx", "app/twitter-image.tsx"]);
  }

  const mustHaveBlog = !!modules.blogMdx;
  if (mustHaveBlog) {
    for (const f of ["app/blog/page.tsx", "app/blog/[slug]/page.tsx", "app/rss.xml/route.ts", "lib/loaders/blog.loader.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) note(`Blog enabled but missing: ${f}`);
    }
    await checkFiles("blog.content", ["content/blog/hello-world.mdx"]);
  }

  if (modules.email === "resend") {
    await checkFiles("email.resend", [
      "lib/env/email.ts",
      "lib/email/resend.ts",
      "lib/email/auth-emails.ts",
      "lib/email/templates/verify-email.tsx",
      "lib/email/templates/reset-password.tsx",
    ]);
  }

  if (modules.pwa) {
    await checkFiles("pwa.public", ["public/manifest.webmanifest", "public/sw.js", "public/offline.html"]);
    await checkFiles("pwa.core", [
      "lib/env/pwa.ts",
      "lib/pwa/register-sw.client.ts",
      "lib/pwa/offline-storage.ts",
      "lib/pwa/push.ts",
      "lib/repos/push-subscriptions.repo.ts",
      "lib/services/push-subscriptions.service.ts",
      "app/api/v1/pwa/push/subscribe/route.ts",
      "app/api/v1/pwa/push/unsubscribe/route.ts",
      "app/api/v1/pwa/push/send/route.ts",
    ]);
  }

  if (modules.jobs?.enabled) {
    await checkFiles("jobs", ["app/api/v1/jobs/reconcile/route.ts"]);
  }

  if (modules.observability?.sentry) {
    await checkFiles("observability.sentry", ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]);
  }

  // Migration expectations (baseline)
  const drizzleConfig = path.join(input.projectRoot, "drizzle.config.ts");
  const drizzleDir = path.join(input.projectRoot, "drizzle", "migrations");
  if (!(await exists(drizzleConfig))) note("Missing drizzle.config.ts (required for migrations)");
  if (!(await exists(drizzleDir))) note("Missing drizzle/migrations directory");

  // Architecture boundary enforcement (static scan, v1)
  // app/** should not import repos/db directly (except webhook ledger usage).
  const appDir = path.join(input.projectRoot, "app");
  const appFiles = await listFilesRecursive(appDir, [".ts", ".tsx"]);
  const banned = [
    { re: /from\s+["']@\/lib\/db\b/, msg: "UI/routes must not import lib/db directly. Use repos/loaders/actions." },
    { re: /from\s+["']@\/lib\/repos\b/, msg: "UI/routes must not import lib/repos directly. Use loaders/actions." },
  ];
  for (const f of appFiles) {
    const src = await fs.readFile(f, "utf8");
    for (const b of banned) {
      if (b.re.test(src)) {
        const rel = path.relative(input.projectRoot, f).replaceAll("\\", "/");
        const isWebhookLedgerAllowed =
          rel.endsWith("app/api/v1/billing/webhook/route.ts") && src.includes("webhook-events.repo");
        if (isWebhookLedgerAllowed) continue;
        note(`Boundary violation in ${path.relative(input.projectRoot, f)}: ${b.msg}`);
      }
    }
  }

  if (issues.length) {
    throw new Error(`doctor failed (${input.profile}):\n- ${issues.join("\n- ")}`);
  }

  logger.success(`doctor ok (${input.profile})`);
}

