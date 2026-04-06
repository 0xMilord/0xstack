import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runAddModule } from "../../src/core/add/run-add-module";

describe("Add Module Command - Full Flow Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-add-flow-"));
    // Create minimal app structure
    await fs.mkdir(path.join(tmpDir, "app"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "db"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "env"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "drizzle", "migrations", "meta"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "repos"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "services"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "loaders"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "actions"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "rules"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "query-keys"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "mutation-keys"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "hooks", "client"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "security"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "cache"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "orgs"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "auth"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "utils"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "0xstack"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "components", "layout"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "api", "v1", "health"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "api", "auth", "[...all]"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "login"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "get-started"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "forgot-password"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "reset-password"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app", "orgs"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app", "settings"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app", "api-keys"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app", "webhooks"), { recursive: true });

    // Write minimal required files
    await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "test-app",
      dependencies: {
        "better-auth": "1.0.0",
        "drizzle-orm": "1.0.0",
        "postgres": "1.0.0",
        "zod": "1.0.0",
        "@tanstack/react-query": "1.0.0",
        "zustand": "1.0.0",
        "next-themes": "1.0.0",
        "@upstash/redis": "1.0.0",
        "@upstash/ratelimit": "1.0.0",
        "@better-auth/drizzle-adapter": "1.0.0",
        "lucide-react": "1.0.0",
        "lru-cache": "1.0.0",
      },
      devDependencies: {
        "drizzle-kit": "1.0.0",
        "vitest": "1.0.0",
        "vite": "1.0.0",
      },
    }), "utf8");

    await fs.writeFile(path.join(tmpDir, "proxy.ts"), `export function proxy() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/db/index.ts"), `export const db = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/db/schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
    await fs.writeFile(path.join(tmpDir, "drizzle.config.ts"), `export default {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "drizzle/migrations/meta/_journal.json"), `{"entries": []}`, "utf8");

    // Env schema
    await fs.writeFile(path.join(tmpDir, "lib/env/schema.ts"), `import { z } from "zod";
import { BillingEnvSchema } from "./billing";
import { StorageEnvSchema } from "./storage";

export const EnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
}).and(BillingEnvSchema.partial()).and(StorageEnvSchema.partial());
`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/env/server.ts"), `export const env = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/env/billing.ts"), `import { z } from "zod";
export const BillingEnvSchema = z.object({
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]),
  DODO_PAYMENTS_RETURN_URL: z.string().url(),
});
`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/env/storage.ts"), `import { z } from "zod";
export const StorageEnvSchema = z.object({
  GCS_BUCKET: z.string().min(1),
  GCS_PROJECT_ID: z.string().min(1),
});
`, "utf8");

    // Config
    await fs.writeFile(path.join(tmpDir, "0xstack.config.ts"), `import { defineConfig } from "./lib/0xstack/config";
export default defineConfig({
  app: { name: "TestApp", baseUrl: "http://localhost:3000" },
  modules: {
    orgs: true, billing: false, storage: false, email: false, cache: true, pwa: false, seo: false, blogMdx: false,
    observability: { sentry: false, otel: false },
    jobs: { enabled: false, driver: "cron-only" },
  },
});
`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/0xstack/config.ts"), `import { z } from "zod";
const ConfigSchema = z.object({
  app: z.object({ name: z.string(), description: z.string().optional(), baseUrl: z.string().url() }),
  modules: z.object({
    auth: z.literal("better-auth").optional(),
    orgs: z.boolean(),
    billing: z.union([z.literal(false), z.literal("dodo"), z.literal("stripe")]),
    storage: z.union([z.literal(false), z.literal("gcs"), z.literal("s3"), z.literal("supabase")]),
    email: z.union([z.literal(false), z.literal("resend")]),
    cache: z.boolean().optional(),
    pwa: z.boolean().optional(),
    seo: z.boolean(),
    blogMdx: z.boolean(),
    observability: z.object({ sentry: z.boolean(), otel: z.boolean() }).optional(),
    jobs: z.object({ enabled: z.boolean(), driver: z.enum(["inngest", "cron-only"]) }).optional(),
  }),
  profiles: z.record(z.string(), z.any()).optional(),
});
export function defineConfig(config) { return ConfigSchema.parse(config); }
`, "utf8");

    // Core files
    await fs.writeFile(path.join(tmpDir, "app/layout.tsx"), `export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/providers.tsx"), `export function Providers({ children }) { return children; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/app/layout.tsx"), `export default async function Layout({ children }) { return children; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/app/settings/page.tsx"), `export default function Page() { return <div>Settings</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/api/v1/health/route.ts"), `export async function GET() { return new Response("ok"); }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/api/auth/[...all]/route.ts"), `export async function GET() { return new Response("auth"); }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/login/page.tsx"), `export default function Page() { return <div>Login</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/get-started/page.tsx"), `export default function Page() { return <div>Signup</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/forgot-password/page.tsx"), `export default function Page() { return <div>Forgot</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/reset-password/page.tsx"), `export default function Page() { return <div>Reset</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/app/orgs/page.tsx"), `export default function Page() { return <div>Orgs</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/app/api-keys/page.tsx"), `export default function Page() { return <div>API Keys</div>; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/app/webhooks/page.tsx"), `export default function Page() { return <div>Webhooks</div>; }`, "utf8");

    // Lib files
    await fs.writeFile(path.join(tmpDir, "lib/auth/auth.ts"), `export const auth = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/auth/auth-schema.ts"), `export const authSchema = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/auth/server.ts"), `export async function requireAuth() { return { userId: "1" }; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/auth/auth-client.ts"), `export const authClient = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/viewer.service.ts"), `export async function viewerService_getViewer() { return null; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/auth.service.ts"), `export async function authService_signOut() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/loaders/viewer.loader.ts"), `export const loadViewer = async () => null;`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/actions/auth.actions.ts"), `export async function signOutAction() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/hooks/client/use-viewer.ts"), `export function useViewer() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/query-keys/auth.keys.ts"), `export const authKeys = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/mutation-keys/auth.keys.ts"), `export const authMutations = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/query-keys/index.ts"), `export * from "./auth.keys";`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/mutation-keys/index.ts"), `export * from "./auth.keys";`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/orgs/active-org.ts"), `export function getActiveOrgIdFromCookies() { return null; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/repos/orgs.repo.ts"), `export async function insertOrg() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/repos/org-members.repo.ts"), `export async function addMember() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/orgs.service.ts"), `export async function orgsService_listForUser() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/actions/orgs.actions.ts"), `export async function createOrg() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/loaders/orgs.loader.ts"), `export const loadMyOrgs = async () => [];`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/query-keys/orgs.keys.ts"), `export const orgsKeys = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/mutation-keys/orgs.keys.ts"), `export const orgsMutations = {};`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/repos/user-profiles.repo.ts"), `export async function getUserProfile() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/profiles.service.ts"), `export async function profilesService_ensureForUser() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/repos/assets.repo.ts"), `export async function insertAsset() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/repos/billing.repo.ts"), `export async function upsertBillingCustomer() {}`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/security/api.ts"), `export async function guardApiRequest() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/api-keys.service.ts"), `export async function verifyApiKey() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/repos/api-keys.repo.ts"), `export async function findActiveApiKeysByPrefix() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/actions/api-keys.actions.ts"), `export async function createApiKeyAction() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/loaders/api-keys.loader.ts"), `export const loadApiKeysForActiveOrg = async () => {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/query-keys/api-keys.keys.ts"), `export const apiKeysKeys = {};`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/repos/webhook-events.repo.ts"), `export async function upsertWebhookEvent() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/webhook-ledger.service.ts"), `export async function webhookLedgerService_list() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/loaders/webhook-ledger.loader.ts"), `export const loadWebhookLedger = async () => [];`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/actions/webhook-ledger.actions.ts"), `export async function replayWebhookEventAction() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/query-keys/webhook-ledger.keys.ts"), `export const webhookLedgerKeys = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/mutation-keys/webhook-ledger.keys.ts"), `export const webhookLedgerMutations = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "app/api/v1/webhooks/ledger/events/route.ts"), `export async function GET() {}`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/cache/config.ts"), `export const CACHE_TTL = {}; export const cacheTags = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/cache/server.ts"), `export function withServerCache() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/cache/revalidate.ts"), `export const revalidate = {};`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/cache/index.ts"), `export * from "./config";`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/cache/lru.ts"), `export function l1GetOrSet() {}`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/utils/logger.ts"), `export const logger = {};`, "utf8");

    await fs.writeFile(path.join(tmpDir, "components/layout/site-header.tsx"), `export async function SiteHeader() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "components/layout/site-footer.tsx"), `export function SiteFooter() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "components/layout/theme-toggle.tsx"), `export function ThemeToggle() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/components/layout/site-header.tsx"), `export * from "@/components/layout/site-header";`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/components/layout/site-footer.tsx"), `export * from "@/components/layout/site-footer";`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/components/layout/theme-toggle.tsx"), `export * from "@/components/layout/theme-toggle";`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/components/layout/app-shell.tsx"), `export function AppShell() {}`, "utf8");

    // ESLint boundaries
    await fs.writeFile(path.join(tmpDir, "eslint.0xstack-boundaries.mjs"), `export default [];`, "utf8");
    await fs.writeFile(path.join(tmpDir, "eslint.config.mjs"), `import oxstackBoundaries from "./eslint.0xstack-boundaries.mjs";
export default [...oxstackBoundaries,];`, "utf8");

    // Module factories
    await fs.writeFile(path.join(tmpDir, "lib/services/module-factories.ts"), `export async function getBillingService() {}
export async function getStorageService() {}
export async function getSeoConfig() {}`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("add module enables SEO and updates config", async () => {
    // Verify SEO is disabled initially
    const configBefore = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configBefore).toContain("seo: false");

    // Add SEO module
    await runAddModule({ projectRoot: tmpDir, moduleId: "seo", profile: "core", packageManager: "pnpm" });

    // Verify config was updated
    const configAfter = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configAfter).toContain("seo: true");

    // Verify SEO files were generated
    const robotsExists = await fs.access(path.join(tmpDir, "app/robots.ts")).then(() => true).catch(() => false);
    expect(robotsExists).toBe(true);

    const sitemapExists = await fs.access(path.join(tmpDir, "app/sitemap.ts")).then(() => true).catch(() => false);
    expect(sitemapExists).toBe(true);

    const jsonldExists = await fs.access(path.join(tmpDir, "lib/seo/jsonld.ts")).then(() => true).catch(() => false);
    expect(jsonldExists).toBe(true);
  }, 120_000);

  it("add module enables blog and updates config", async () => {
    const configBefore = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configBefore).toContain("blogMdx: false");

    await runAddModule({ projectRoot: tmpDir, moduleId: "blogMdx", profile: "core", packageManager: "pnpm" });

    const configAfter = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configAfter).toContain("blogMdx: true");

    const blogPageExists = await fs.access(path.join(tmpDir, "app/blog/page.tsx")).then(() => true).catch(() => false);
    expect(blogPageExists).toBe(true);

    const blogLoaderExists = await fs.access(path.join(tmpDir, "lib/loaders/blog.loader.ts")).then(() => true).catch(() => false);
    expect(blogLoaderExists).toBe(true);
  }, 120_000);

  it("add module enables PWA and updates config", async () => {
    const configBefore = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configBefore).toContain("pwa: false");

    await runAddModule({ projectRoot: tmpDir, moduleId: "pwa", profile: "core", packageManager: "pnpm" });

    const configAfter = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configAfter).toContain("pwa: true");

    const manifestExists = await fs.access(path.join(tmpDir, "public/manifest.webmanifest")).then(() => true).catch(() => false);
    expect(manifestExists).toBe(true);
  }, 120_000);

  it("add module enables Sentry and updates config", async () => {
    const configBefore = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configBefore).toContain("sentry: false");

    await runAddModule({ projectRoot: tmpDir, moduleId: "observability", profile: "core", packageManager: "pnpm" });

    const configAfter = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configAfter).toContain("sentry: true");

    const sentryClientExists = await fs.access(path.join(tmpDir, "sentry.client.config.ts")).then(() => true).catch(() => false);
    expect(sentryClientExists).toBe(true);
  }, 120_000);

  it("add module enables jobs and updates config", async () => {
    const configBefore = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configBefore).toContain("enabled: false");

    await runAddModule({ projectRoot: tmpDir, moduleId: "jobs", profile: "core", packageManager: "pnpm" });

    const configAfter = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(configAfter).toContain("enabled: true");

    const reconcileExists = await fs.access(path.join(tmpDir, "lib/jobs/reconcile.ts")).then(() => true).catch(() => false);
    expect(reconcileExists).toBe(true);
  }, 120_000);

  it("add module rejects invalid module ID", async () => {
    await expect(runAddModule({ projectRoot: tmpDir, moduleId: "nonexistent-module", profile: "core", packageManager: "pnpm" })).rejects.toThrow();
  }, 30_000);

  it("add module runs baseline after enabling", async () => {
    // Add a module that triggers baseline
    await runAddModule({ projectRoot: tmpDir, moduleId: "seo", profile: "core", packageManager: "pnpm" });

    // Baseline should have generated ESLint boundaries
    const eslintBoundaries = await fs.readFile(path.join(tmpDir, "eslint.0xstack-boundaries.mjs"), "utf8");
    expect(eslintBoundaries).toContain("no-restricted-imports");

    // Baseline should have generated module factories
    const moduleFactories = await fs.readFile(path.join(tmpDir, "lib/services/module-factories.ts"), "utf8");
    expect(moduleFactories).toContain("getBillingService");
  }, 120_000);

  it("add module installs new dependencies", async () => {
    const pkgBefore = JSON.parse(await fs.readFile(path.join(tmpDir, "package.json"), "utf8"));
    expect(pkgBefore.dependencies).not.toHaveProperty("schema-dts");

    await runAddModule({ projectRoot: tmpDir, moduleId: "seo", profile: "core", packageManager: "pnpm" });

    const pkgAfter = JSON.parse(await fs.readFile(path.join(tmpDir, "package.json"), "utf8"));
    expect(pkgAfter.dependencies).toHaveProperty("schema-dts");
  }, 120_000);

  it("add module generates docs after enabling", async () => {
    await runAddModule({ projectRoot: tmpDir, moduleId: "seo", profile: "core", packageManager: "pnpm" });

    const readmeExists = await fs.access(path.join(tmpDir, "README.md")).then(() => true).catch(() => false);
    expect(readmeExists).toBe(true);

    const prdExists = await fs.access(path.join(tmpDir, "PRD.md")).then(() => true).catch(() => false);
    expect(prdExists).toBe(true);
  }, 120_000);
});
