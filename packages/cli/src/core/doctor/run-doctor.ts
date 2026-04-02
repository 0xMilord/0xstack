import fs from "node:fs/promises";
import path from "node:path";
import { computeProjectState } from "../project/project-state";
import { logger } from "../logger";
import { applyProfile, loadConfig } from "../config";
import { expectedDepsForConfig } from "../deps";
import chalk from "chalk";

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

export type DoctorInput = { projectRoot: string; profile: string; strict?: boolean };

type IssueSeverity = "critical" | "warning" | "info";

type Issue = {
  message: string;
  severity: IssueSeverity;
  category: string;
  fix?: string | undefined;
};

export async function runDoctor(input: DoctorInput) {
  const state = await computeProjectState(input.projectRoot, input.profile);
  const modules = state.modules as any;

  const issues: Issue[] = [];
  const strictOnly: Issue[] = [];

  const addIssue = (message: string, severity: "critical" | "warning" | "info" = "critical", category: string = "General", fix?: string) => {
    issues.push({ message, severity, category, fix: fix ?? undefined });
  };

  const addStrict = (message: string, severity: "critical" | "warning" | "info" = "warning", category: string = "Hygiene", fix?: string) => {
    strictOnly.push({ message, severity, category, fix: fix ?? undefined });
  };

  const checkAbsent = async (label: string, files: string[]) => {
    const present: string[] = [];
    for (const f of files) {
      if (await exists(path.join(input.projectRoot, f))) present.push(f);
    }
    if (present.length) addIssue(`${label}: should be removed when disabled: ${present.join(", ")}`, "warning", "Module Cleanup", "Run `0xstack sync --apply` to remove disabled module files");
  };

  const requiredFiles = ["proxy.ts", "lib/env/schema.ts", "lib/env/server.ts", "lib/db/index.ts", "lib/db/schema.ts"];
  for (const f of requiredFiles) {
    const p = path.join(input.projectRoot, f);
    if (!(await exists(p))) addIssue(`Missing required file: ${f}`, "critical", "Core Files");
  }

  // Dependency parity (missing deps are errors; extra deps are allowed)
  try {
    const cfg = applyProfile(await loadConfig(input.projectRoot), input.profile);
    const expected = expectedDepsForConfig(cfg);
    const pkgPath = path.join(input.projectRoot, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as any;
    const deps = new Set<string>(Object.keys(pkg?.dependencies ?? {}));
    const devDeps = new Set<string>(Object.keys(pkg?.devDependencies ?? {}));
    const missingDeps = expected.deps.filter((d) => !deps.has(d));
    const missingDevDeps = expected.devDeps.filter((d) => !devDeps.has(d));
    if (missingDeps.length) addIssue(`Missing dependencies: ${missingDeps.join(", ")}`, "critical", "Dependencies", "Run `pnpm install` or `0xstack baseline`");
    if (missingDevDeps.length) addIssue(`Missing devDependencies: ${missingDevDeps.join(", ")}`, "warning", "Dependencies", "Run `pnpm install` or `0xstack baseline`");
  } catch {
    addIssue("Unable to validate dependency parity (package.json/config unreadable)", "warning", "Dependencies");
  }

  const checkFiles = async (label: string, files: string[], category: string = "Files") => {
    const missing: string[] = [];
    for (const f of files) {
      if (!(await exists(path.join(input.projectRoot, f)))) missing.push(f);
    }
    if (missing.length) addIssue(`${label}: missing ${missing.join(", ")}`, "critical", category, "Run `0xstack baseline` to generate missing files");
  };

  // Env invariants (file-level, plus module-specific required keys in schema)
  const envSchemaPath = path.join(input.projectRoot, "lib/env/schema.ts");
  const envSchema = (await exists(envSchemaPath)) ? await fs.readFile(envSchemaPath, "utf8") : "";
  const requireEnvKey = (key: string) => {
    if (!envSchema.includes(key)) addIssue(`Env schema missing required key: ${key}`, "critical", "Environment");
  };
  requireEnvKey("DATABASE_URL");
  requireEnvKey("BETTER_AUTH_SECRET");
  requireEnvKey("BETTER_AUTH_URL");
  requireEnvKey("NEXT_PUBLIC_APP_URL");
  requireEnvKey("NEXT_PUBLIC_APP_NAME");

  // Query/mutation keys conventions
  await checkFiles("keys.indices", ["lib/query-keys/index.ts", "lib/mutation-keys/index.ts"], "Query Keys");

  // Query key completeness (each domain should have keys)
  const queryKeysDir = path.join(input.projectRoot, "lib", "query-keys");
  if (await exists(queryKeysDir)) {
    const queryKeyFiles = await fs.readdir(queryKeysDir);
    const expectedDomains = ["auth", "orgs"];
    if (modules.billing) expectedDomains.push("billing");
    if (modules.storage) expectedDomains.push("assets");
    if (modules.blogMdx) expectedDomains.push("blog");
    for (const domain of expectedDomains) {
      if (!queryKeyFiles.some((f) => f.startsWith(domain))) {
        addIssue(`Query keys: missing ${domain}.keys.ts`, "warning", "Query Keys");
      }
    }
  }

  // Always-on foundations (per-layer sanity)
  await checkFiles("foundation.ui", [
    "app/layout.tsx",
    "app/providers.tsx",
    "app/app/layout.tsx",
    "app/app/settings/page.tsx",
  ]);
  await checkFiles("foundation.orgs.active", ["lib/orgs/active-org.ts"]);
  await checkFiles("foundation.health", ["app/api/v1/health/route.ts"]);
  await checkFiles("foundation.auth", [
    "app/api/auth/[...all]/route.ts",
    "lib/auth/auth.ts",
    "lib/auth/auth-schema.ts",
    "lib/services/viewer.service.ts",
    "lib/loaders/viewer.loader.ts",
    "lib/actions/auth.actions.ts",
    "lib/hooks/client/use-viewer.ts",
    "app/login/page.tsx",
    "app/get-started/page.tsx",
    "app/forgot-password/page.tsx",
    "app/reset-password/page.tsx",
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
  await checkFiles("foundation.webhook-ledger", [
    "lib/repos/webhook-events.repo.ts",
    "lib/services/webhook-ledger.service.ts",
    "lib/loaders/webhook-ledger.loader.ts",
    "lib/actions/webhook-ledger.actions.ts",
    "app/app/webhooks/page.tsx",
    "app/api/v1/webhooks/ledger/events/route.ts",
  ]);
  await checkFiles("foundation.api-keys.ux", ["app/app/api-keys/page.tsx", "lib/actions/api-keys.actions.ts", "lib/loaders/api-keys.loader.ts"]);

  const billingApis = [
    "app/api/v1/billing/checkout/route.ts",
    "app/api/v1/billing/portal/route.ts",
    "app/api/v1/billing/webhook/route.ts",
  ];
  const billingUx = [
    "app/pricing/page.tsx",
    "app/billing/success/page.tsx",
    "app/billing/cancel/page.tsx",
    "app/app/billing/page.tsx",
  ];
  const billingShared = [
    "lib/billing/runtime.ts",
    "lib/loaders/billing.loader.ts",
    "lib/query-keys/billing.keys.ts",
    "lib/billing/plans.ts",
    "lib/actions/billing.actions.ts",
    "lib/services/billing.service.ts",
    "lib/hooks/client/use-billing.client.ts",
  ];

  if (modules.billing === "dodo") {
    const billingEnvPath = path.join(input.projectRoot, "lib/env/billing.ts");
    if (!(await exists(billingEnvPath))) addIssue("Billing (Dodo) enabled but missing lib/env/billing.ts");
    const billingEnv = (await exists(billingEnvPath)) ? await fs.readFile(billingEnvPath, "utf8") : "";
    for (const key of ["DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_KEY", "DODO_PAYMENTS_ENVIRONMENT", "DODO_PAYMENTS_RETURN_URL"]) {
      if (!billingEnv.includes(key)) addIssue(`Billing env schema missing key: ${key}`);
    }
    await checkFiles("billing.dodo.vendor", ["lib/billing/dodo.webhooks.ts"]);
  }

  if (modules.billing === "stripe") {
    const stripeEnvPath = path.join(input.projectRoot, "lib/env/billing-stripe.ts");
    if (!(await exists(stripeEnvPath))) addIssue("Billing (Stripe) enabled but missing lib/env/billing-stripe.ts");
    const stripeEnv = (await exists(stripeEnvPath)) ? await fs.readFile(stripeEnvPath, "utf8") : "";
    for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_RETURN_URL", "STRIPE_STARTER_PRICE_ID"]) {
      if (!stripeEnv.includes(key)) addIssue(`Stripe billing env schema missing key: ${key}`);
    }
    await checkFiles("billing.stripe.vendor", ["lib/billing/stripe.ts"]);
  }

  if (modules.billing === "dodo" || modules.billing === "stripe") {
    await checkFiles("billing.apis", billingApis);
    await checkFiles("billing.ux", billingUx);
    await checkFiles("billing.core", [...billingShared, "lib/repos/billing.repo.ts"]);
  }

  if (modules.billing === false) {
    await checkAbsent("billing.disabled", [
      ...billingApis,
      ...billingUx,
      ...billingShared,
      "lib/billing/dodo.webhooks.ts",
      "lib/billing/stripe.ts",
    ]);
  }

  const storageApis = [
    "app/api/v1/storage/sign-upload/route.ts",
    "app/api/v1/storage/sign-read/route.ts",
    "app/api/v1/storage/assets/route.ts",
    "app/api/v1/storage/assets/[assetId]/route.ts",
  ];
  const storageUi = ["app/app/assets/page.tsx", "app/app/assets/assets-client.tsx", "app/app/assets/[assetId]/page.tsx"];
  const storageShared = [
    "lib/storage/runtime.ts",
    "lib/storage/provider.ts",
    "lib/services/storage.service.ts",
    "lib/loaders/assets.loader.ts",
    "lib/actions/assets.actions.ts",
    "lib/query-keys/assets.keys.ts",
    "lib/hooks/client/use-assets.client.ts",
  ];

  if (modules.storage === "gcs") {
    const storageEnvPath = path.join(input.projectRoot, "lib/env/storage.ts");
    if (!(await exists(storageEnvPath))) addIssue("Storage (GCS) enabled but missing lib/env/storage.ts");
    const storageEnv = (await exists(storageEnvPath)) ? await fs.readFile(storageEnvPath, "utf8") : "";
    for (const key of ["GCS_BUCKET", "GCS_PROJECT_ID"]) {
      if (!storageEnv.includes(key)) addIssue(`GCS storage env schema missing key: ${key}`);
    }
    await checkFiles("storage.gcs.provider", ["lib/storage/providers/gcs.ts"]);
  }

  if (modules.storage === "s3") {
    const s3EnvPath = path.join(input.projectRoot, "lib/env/storage-s3.ts");
    if (!(await exists(s3EnvPath))) addIssue("Storage (S3) enabled but missing lib/env/storage-s3.ts");
    const s3Env = (await exists(s3EnvPath)) ? await fs.readFile(s3EnvPath, "utf8") : "";
    for (const key of ["S3_REGION", "S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
      if (!s3Env.includes(key)) addIssue(`S3 storage env schema missing key: ${key}`);
    }
    await checkFiles("storage.s3.provider", ["lib/storage/s3.ts", "lib/storage/providers/s3.ts"]);
  }

  if (modules.storage === "supabase") {
    const supEnvPath = path.join(input.projectRoot, "lib/env/storage-supabase.ts");
    if (!(await exists(supEnvPath))) addIssue("Storage (Supabase) enabled but missing lib/env/storage-supabase.ts");
    const supEnv = (await exists(supEnvPath)) ? await fs.readFile(supEnvPath, "utf8") : "";
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"]) {
      if (!supEnv.includes(key)) addIssue(`Supabase storage env schema missing key: ${key}`);
    }
    await checkFiles("storage.supabase.provider", ["lib/storage/supabase.ts", "lib/storage/providers/supabase.ts"]);
  }

  if (modules.storage === "gcs" || modules.storage === "s3" || modules.storage === "supabase") {
    await checkFiles("storage.apis", storageApis);
    await checkFiles("storage.cqrs", [
      ...storageShared.filter((f) => !f.includes("hooks")),
      "lib/mutation-keys/assets.keys.ts",
    ]);
    await checkFiles("storage.ui", storageUi);
    await checkFiles("storage.repo", ["lib/repos/assets.repo.ts"]);
  }

  if (modules.storage === false) {
    await checkAbsent("storage.disabled", [
      ...storageApis,
      ...storageUi,
      ...storageShared,
      "lib/storage/providers/gcs.ts",
      "lib/storage/providers/s3.ts",
      "lib/storage/providers/supabase.ts",
      "lib/storage/gcs.ts",
      "lib/storage/s3.ts",
      "lib/storage/supabase.ts",
      "lib/mutation-keys/assets.keys.ts",
    ]);
  }

  // Module-gated surfaces
  const mustHaveSeo = !!modules.seo;
  if (mustHaveSeo) {
    for (const f of ["app/robots.ts", "app/sitemap.ts", "lib/seo/jsonld.ts", "lib/seo/runtime.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) addIssue(`SEO enabled but missing: ${f}`);
    }
    await checkFiles("seo.social-images", ["app/opengraph-image.tsx", "app/twitter-image.tsx"]);
  }
  if (!mustHaveSeo) {
    await checkAbsent("seo.disabled", [
      "app/robots.ts",
      "app/sitemap.ts",
      "lib/seo/jsonld.ts",
      "lib/seo/runtime.ts",
      "app/opengraph-image.tsx",
      "app/twitter-image.tsx",
    ]);
  }

  const mustHaveBlog = !!modules.blogMdx;
  if (mustHaveBlog) {
    for (const f of ["app/blog/page.tsx", "app/blog/[slug]/page.tsx", "app/rss.xml/route.ts", "lib/loaders/blog.loader.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) addIssue(`Blog enabled but missing: ${f}`);
    }
    await checkFiles("blog.content", ["content/blog/hello-world.mdx"]);
  }
  if (!mustHaveBlog) {
    await checkAbsent("blog.disabled", ["app/blog/page.tsx", "app/blog/[slug]/page.tsx", "app/rss.xml/route.ts", "lib/loaders/blog.loader.ts"]);
  }

  if (modules.email === "resend") {
    await checkFiles("email.resend", [
      "lib/env/email.ts",
      "lib/email/resend.ts",
      "lib/email/auth-emails.ts",
      "lib/email/templates/verify-email.tsx",
      "lib/email/templates/reset-password.tsx",
      "lib/email/templates/welcome-email.tsx",
    ]);
    const emailEnvPath = path.join(input.projectRoot, "lib/env/email.ts");
    const emailEnv = (await exists(emailEnvPath)) ? await fs.readFile(emailEnvPath, "utf8") : "";
    for (const key of ["RESEND_API_KEY", "RESEND_FROM"]) {
      if (!emailEnv.includes(key)) addIssue(`Email env schema missing required key: ${key}`);
    }
  }
  if (modules.email !== "resend") {
    await checkAbsent("email.disabled", [
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
    await checkFiles("pwa.ux", ["app/app/pwa/page.tsx", "app/app/pwa/pwa-client.tsx", "lib/loaders/pwa.loader.ts", "lib/actions/pwa.actions.ts"]);
  }
  if (!modules.pwa) {
    await checkAbsent("pwa.disabled", [
      "public/manifest.webmanifest",
      "public/sw.js",
      "public/offline.html",
      "lib/env/pwa.ts",
      "lib/pwa/register-sw.client.ts",
      "lib/pwa/offline-storage.ts",
      "lib/pwa/push.ts",
      "lib/repos/push-subscriptions.repo.ts",
      "lib/services/push-subscriptions.service.ts",
      "app/api/v1/pwa/push/subscribe/route.ts",
      "app/api/v1/pwa/push/unsubscribe/route.ts",
      "app/api/v1/pwa/push/send/route.ts",
      "app/app/pwa/page.tsx",
      "app/app/pwa/pwa-client.tsx",
      "lib/loaders/pwa.loader.ts",
      "lib/actions/pwa.actions.ts",
    ]);
  }

  if (modules.jobs?.enabled) {
    await checkFiles("jobs", ["app/api/v1/jobs/reconcile/route.ts", "lib/jobs/reconcile.ts"]);
  }
  if (!modules.jobs?.enabled) {
    await checkAbsent("jobs.disabled", ["app/api/v1/jobs/reconcile/route.ts", "lib/jobs/reconcile.ts"]);
  }

  if (modules.observability?.sentry) {
    await checkFiles("observability.sentry", ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]);
  }

  // Migration expectations (baseline)
  const drizzleConfig = path.join(input.projectRoot, "drizzle.config.ts");
  const drizzleDir = path.join(input.projectRoot, "drizzle", "migrations");
  if (!(await exists(drizzleConfig))) addIssue("Missing drizzle.config.ts (required for migrations)");
  if (!(await exists(drizzleDir))) addIssue("Missing drizzle/migrations directory");
  const journal = path.join(input.projectRoot, "drizzle", "migrations", "meta", "_journal.json");
  if (!(await exists(journal)))
    addIssue("Missing drizzle/migrations/meta/_journal.json (migration journal). Run baseline to initialize migrations.");
  try {
    const schemaPath = path.join(input.projectRoot, "lib", "db", "schema.ts");
    const schemaSrc = (await exists(schemaPath)) ? await fs.readFile(schemaPath, "utf8") : "";
    const hasTables = schemaSrc.includes("pgTable(");
    const migrationFiles = (await exists(drizzleDir)) ? await fs.readdir(drizzleDir).catch(() => []) : [];
    const sqlMigrations = migrationFiles.filter((f) => f.endsWith(".sql"));
    if (hasTables && sqlMigrations.length === 0) {
      addIssue("Migration drift: schema has tables but drizzle/migrations has no .sql migrations. Run baseline to generate migrations.");
    }
  } catch {
    // ignore
  }

  // Migration drift (journal ↔ files)
  try {
    if (await exists(journal)) {
      const j = JSON.parse(await fs.readFile(journal, "utf8")) as any;
      const entries: Array<{ tag: string; idx: number }> = Array.isArray(j?.entries) ? j.entries : [];
      for (const e of entries) {
        const tag = String(e.tag ?? "");
        if (!tag) continue;
        const sqlPath = path.join(input.projectRoot, "drizzle", "migrations", `${tag}.sql`);
        if (!(await exists(sqlPath))) addIssue(`Migration drift: journal entry ${tag} missing file drizzle/migrations/${tag}.sql`);
      }
      const metaDir = path.join(input.projectRoot, "drizzle", "migrations", "meta");
      const metaFiles = (await exists(metaDir)) ? await fs.readdir(metaDir).catch(() => []) : [];
      const snapshotFiles = metaFiles.filter((f) => f.endsWith("_snapshot.json"));
      const expectedSnapshots = entries.map((e) => String(e.tag ?? "")).filter(Boolean);
      // Best-effort: ensure at least one snapshot exists when journal has entries
      if (entries.length > 0 && snapshotFiles.length === 0) {
        addIssue("Migration drift: journal has entries but no meta/*_snapshot.json files exist.");
      }
    }
  } catch {
    addIssue("Unable to validate drizzle journal/migration drift (journal unreadable).");
  }

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
          (rel.endsWith("app/api/v1/billing/webhook/route.ts") || rel.endsWith("app/api/v1/billing/webhook/route.tsx")) &&
          src.includes("webhook-events.repo");
        if (isWebhookLedgerAllowed) continue;
        addIssue(`Boundary violation in ${rel}: ${b.msg}`, "critical", "Architecture");
      }
    }
  }

  // CQRS boundaries (static scan)
  const scanLayer = async (label: string, dirRel: string, exts: string[], bannedImports: Array<{ re: RegExp; msg: string }>) => {
    const d = path.join(input.projectRoot, ...dirRel.split("/"));
    if (!(await exists(d))) return;
    const files = await listFilesRecursive(d, exts);
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      for (const b of bannedImports) {
        if (b.re.test(src)) {
          addIssue(`${label}: ${path.relative(input.projectRoot, f)} ${b.msg}`, "critical", "Architecture");
        }
      }
    }
  };

  await scanLayer("actions.boundary", "lib/actions", [".ts"], [
    { re: /from\s+["']@\/lib\/db\b/, msg: "must not import lib/db (use services)" },
    { re: /from\s+["']@\/lib\/repos\b/, msg: "must not import lib/repos (use services)" },
  ]);

  await scanLayer("loaders.boundary", "lib/loaders", [".ts"], [
    { re: /from\s+["']@\/lib\/db\b/, msg: "must not import lib/db (use services)" },
    { re: /from\s+["']@\/lib\/repos\b/, msg: "must not import lib/repos (use services)" },
    { re: /from\s+["']@\/lib\/actions\b/, msg: "must not import actions" },
    { re: /from\s+["']@\/lib\/rules\b/, msg: "must not import rules" },
  ]);

  await scanLayer("services.boundary", "lib/services", [".ts"], [
    { re: /from\s+["']@\/lib\/actions\b/, msg: "must not import actions" },
    { re: /from\s+["']@\/lib\/loaders\b/, msg: "must not import loaders" },
    { re: /from\s+["']next\//, msg: "should not import next/* (keep services framework-agnostic)" },
  ]);

  const loaderDir = path.join(input.projectRoot, "lib", "loaders");
  if (await exists(loaderDir)) {
    const loaderFiles = await listFilesRecursive(loaderDir, [".ts"]);
    for (const f of loaderFiles) {
      const src = await fs.readFile(f, "utf8");
      if (/from\s+["']@\/lib\/actions/.test(src) || /from\s+["']@\/lib\/rules/.test(src)) {
        addIssue(`Loader purity: ${path.relative(input.projectRoot, f)} must not import actions or rules`, "warning", "Architecture");
      }
    }
  }

  if (!(await exists(path.join(input.projectRoot, "eslint.0xstack-boundaries.mjs")))) {
    addStrict("Missing eslint.0xstack-boundaries.mjs", "warning", "Hygiene", "Run `0xstack baseline`");
  }
  if (!(await exists(path.join(input.projectRoot, "lib", "services", "module-factories.ts")))) {
    addStrict("Missing lib/services/module-factories.ts", "warning", "Hygiene", "Run `0xstack baseline`");
  }

  // Module factories completeness (when modules are enabled)
  const moduleFactoriesPath = path.join(input.projectRoot, "lib", "services", "module-factories.ts");
  if (await exists(moduleFactoriesPath)) {
    const src = await fs.readFile(moduleFactoriesPath, "utf8");
    if (modules.billing && !src.includes("getBillingService")) {
      addIssue("Module factories: billing enabled but getBillingService() missing", "critical", "Module Factories");
    }
    if (modules.storage && !src.includes("getStorageService")) {
      addIssue("Module factories: storage enabled but getStorageService() missing", "critical", "Module Factories");
    }
    if (modules.seo && !src.includes("getSeoConfig")) {
      addIssue("Module factories: SEO enabled but getSeoConfig() missing", "critical", "Module Factories");
    }
  }

  const coreRepoBases = new Set([
    "orgs",
    "org-members",
    "user-profiles",
    "billing",
    "assets",
    "api-keys",
    "webhook-events",
    "push-subscriptions",
  ]);
  const reposDir = path.join(input.projectRoot, "lib", "repos");
  if (await exists(reposDir)) {
    const repoFiles = await fs.readdir(reposDir);
    for (const rf of repoFiles) {
      if (!rf.endsWith(".repo.ts")) continue;
      const base = rf.replace(/\.repo\.ts$/, "");
      if (coreRepoBases.has(base)) continue;
      const testDir = path.join(input.projectRoot, "tests", base);
      for (const suffix of [`${base}.repo.test.ts`, `${base}.rules.test.ts`, `${base}.actions.test.ts`]) {
        const tp = path.join(testDir, suffix);
        if (!(await exists(tp))) {
          addStrict(`Domain "${base}" missing tests/${base}/${suffix}`, "info", "Tests");
        }
      }
    }
  }

  // Calculate health score
  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount = [...issues, ...strictOnly].filter(i => i.severity === "warning").length;
  const infoCount = [...issues, ...strictOnly].filter(i => i.severity === "info").length;

  // Health score: 100 - (critical * 15) - (warning * 5) - (info * 1), min 0
  const healthScore = Math.max(0, 100 - (criticalCount * 15) - (warningCount * 5) - (infoCount * 1));

  // Print formatted output
  logger.info("");
  logger.info(chalk.bold.cyan("┌" + "─".repeat(50) + "┐"));
  logger.info(chalk.bold.cyan("│") + chalk.bold.white("  🔍 0xstack Doctor — Project Health       ") + chalk.bold.cyan("│"));
  logger.info(chalk.bold.cyan("└" + "─".repeat(50) + "┘"));
  logger.info("");

  // Category summary
  const categories = new Map<string, { critical: number; warning: number; info: number }>();
  for (const issue of issues) {
    const cat = categories.get(issue.category) || { critical: 0, warning: 0, info: 0 };
    cat[issue.severity]++;
    categories.set(issue.category, cat);
  }

  logger.info(chalk.bold("Categories:"));
  for (const [cat, counts] of categories.entries()) {
    const parts = [];
    if (counts.critical) parts.push(chalk.red(`${counts.critical} critical`));
    if (counts.warning) parts.push(chalk.yellow(`${counts.warning} warnings`));
    if (counts.info) parts.push(chalk.blue(`${counts.info} info`));
    logger.info(`  ${chalk.white(cat)}: ${parts.join(", ")}`);
  }
  logger.info("");

  // Health score display
  const scoreColor = healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
  const scoreBar = "█".repeat(Math.floor(healthScore / 5)) + "░".repeat(20 - Math.floor(healthScore / 5));
  logger.info(chalk.bold("Health Score:"));
  logger.info(`  ${scoreColor(scoreBar)} ${scoreColor(healthScore)}/100`);
  logger.info("");

  // Issues by severity
  if (criticalCount > 0) {
    logger.info(chalk.bold.red("❌ Critical Issues (must fix):"));
    for (const issue of issues.filter(i => i.severity === "critical")) {
      logger.info(chalk.red(`  • ${issue.message}`));
      if (issue.fix) logger.info(chalk.dim(`    💡 ${issue.fix}`));
    }
    logger.info("");
  }

  if (warningCount > 0) {
    logger.info(chalk.bold.yellow("⚠️  Warnings (should fix):"));
    for (const issue of [...issues, ...strictOnly].filter(i => i.severity === "warning")) {
      logger.info(chalk.yellow(`  • ${issue.message}`));
      if (issue.fix) logger.info(chalk.dim(`    💡 ${issue.fix}`));
    }
    logger.info("");
  }

  if (infoCount > 0 && input.strict) {
    logger.info(chalk.bold.blue("ℹ️  Info (nice to have):"));
    for (const issue of [...issues, ...strictOnly].filter(i => i.severity === "info")) {
      logger.info(chalk.blue(`  • ${issue.message}`));
    }
    logger.info("");
  }

  // Quick fix summary
  if (issues.length > 0) {
    logger.info(chalk.bold.green("💡 Quick Fixes:"));
    const hasMissingFiles = issues.some(i => i.message.includes("missing") || i.message.includes("Missing"));
    const hasMissingDeps = issues.some(i => i.message.includes("dependencies"));
    if (hasMissingFiles) logger.info(chalk.green(`  1. Run: ${chalk.bold("npx 0xstack baseline --profile " + input.profile)}`));
    if (hasMissingDeps) logger.info(chalk.green(`  2. Run: ${chalk.bold("pnpm install")}`));
    logger.info("");
  }

  // Exit with appropriate status
  if (criticalCount > 0 || (!!input.strict && (issues.length + strictOnly.length) > 0)) {
    const allIssues = [...issues, ...(input.strict ? strictOnly : [])];
    throw new Error(`doctor failed (${input.profile}): ${criticalCount} critical, ${warningCount} warnings, ${infoCount} info`);
  }

  logger.success(chalk.green(`✓ All checks passed (${input.profile}) — Health: ${healthScore}/100`));
  logger.info("");
}

