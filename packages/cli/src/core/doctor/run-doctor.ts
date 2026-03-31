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

  const requiredFiles = ["proxy.ts", "lib/env/schema.ts", "lib/env/server.ts", "lib/db/index.ts", "lib/db/schema.ts"];
  for (const f of requiredFiles) {
    const p = path.join(input.projectRoot, f);
    if (!(await exists(p))) throw new Error(`Missing required file: ${f}`);
  }

  // Env invariants (file-level, plus module-specific required keys in schema)
  const envSchemaPath = path.join(input.projectRoot, "lib/env/schema.ts");
  const envSchema = await fs.readFile(envSchemaPath, "utf8");
  const requireEnvKey = (key: string) => {
    if (!envSchema.includes(key)) throw new Error(`Env schema missing required key: ${key}`);
  };
  requireEnvKey("DATABASE_URL");
  requireEnvKey("BETTER_AUTH_SECRET");
  requireEnvKey("BETTER_AUTH_URL");
  requireEnvKey("NEXT_PUBLIC_APP_URL");

  if (modules.billing === "dodo") {
    const billingEnvPath = path.join(input.projectRoot, "lib/env/billing.ts");
    if (!(await exists(billingEnvPath))) throw new Error("Billing enabled but missing lib/env/billing.ts");
    const billingEnv = await fs.readFile(billingEnvPath, "utf8");
    for (const key of ["DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_KEY", "DODO_PAYMENTS_ENVIRONMENT", "DODO_PAYMENTS_RETURN_URL"]) {
      if (!billingEnv.includes(key)) throw new Error(`Billing env schema missing key: ${key}`);
    }
  }
  if (modules.storage === "gcs") {
    const storageEnvPath = path.join(input.projectRoot, "lib/env/storage.ts");
    if (!(await exists(storageEnvPath))) throw new Error("Storage enabled but missing lib/env/storage.ts");
    const storageEnv = await fs.readFile(storageEnvPath, "utf8");
    for (const key of ["GCS_BUCKET", "GCS_PROJECT_ID"]) {
      if (!storageEnv.includes(key)) throw new Error(`Storage env schema missing key: ${key}`);
    }
  }

  // Module-gated surfaces
  const mustHaveSeo = !!modules.seo;
  if (mustHaveSeo) {
    for (const f of ["app/robots.ts", "app/sitemap.ts", "lib/seo/jsonld.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) throw new Error(`SEO enabled but missing: ${f}`);
    }
  }

  const mustHaveBlog = !!modules.blogMdx;
  if (mustHaveBlog) {
    for (const f of ["app/blog/page.tsx", "app/blog/[slug]/page.tsx", "app/rss.xml/route.ts", "lib/loaders/blog.loader.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) throw new Error(`Blog enabled but missing: ${f}`);
    }
  }

  if (modules.billing === "dodo") {
    for (const f of ["app/api/v1/billing/checkout/route.ts", "app/api/v1/billing/portal/route.ts", "app/api/v1/billing/webhook/route.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) throw new Error(`Billing enabled but missing: ${f}`);
    }
  }

  if (modules.storage === "gcs") {
    for (const f of ["lib/storage/gcs.ts", "app/api/v1/storage/sign-upload/route.ts"]) {
      if (!(await exists(path.join(input.projectRoot, f)))) throw new Error(`Storage enabled but missing: ${f}`);
    }
  }

  // Migration expectations (baseline)
  const drizzleConfig = path.join(input.projectRoot, "drizzle.config.ts");
  const drizzleDir = path.join(input.projectRoot, "drizzle", "migrations");
  if (!(await exists(drizzleConfig))) throw new Error("Missing drizzle.config.ts (required for migrations)");
  if (!(await exists(drizzleDir))) throw new Error("Missing drizzle/migrations directory");

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
        throw new Error(`Boundary violation in ${path.relative(input.projectRoot, f)}: ${b.msg}`);
      }
    }
  }

  logger.success(`doctor ok (${input.profile})`);
}

