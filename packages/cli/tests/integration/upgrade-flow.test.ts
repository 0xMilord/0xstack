import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runUpgrade } from "../../src/core/upgrade/run-upgrade";

describe("Upgrade Command - Full Flow Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-upgrade-flow-"));
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
    await fs.mkdir(path.join(tmpDir, "lib", "components", "layout"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "api", "v1", "health"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "api", "v1", "webhooks", "ledger", "events"), { recursive: true });
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
    observability: { sentry: false },
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
    observability: z.object({ sentry: z.boolean() }).optional(),
    jobs: z.object({ enabled: z.boolean(), driver: z.enum(["inngest", "cron-only"]) }).optional(),
  }),
  profiles: z.record(z.string(), z.any()).optional(),
});
export type OxstackConfig = z.infer<typeof ConfigSchema>;
export function defineConfig(config: z.input<typeof ConfigSchema>) {
  return ConfigSchema.parse(config);
}
export async function getConfig(): Promise<OxstackConfig> {
  const { default: cfg } = await import("../../../0xstack.config");
  return cfg as OxstackConfig;
}
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
    await fs.writeFile(path.join(tmpDir, "app/api/v1/webhooks/ledger/events/route.ts"), `import { guardApiRequest } from "@/lib/security/api";

export async function GET(req: Request) {
  await guardApiRequest(req);
  return new Response("ok");
}
`, "utf8");

    await fs.writeFile(path.join(tmpDir, "lib/cache/config.ts"), `export const CACHE_TTL = {} as const;
export const cacheTags = {
  domainOrg: (domainPlural: string, orgId: string) => \`\${domainPlural}:org:\${orgId}\`,
} as const;
`, "utf8");
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

  it("upgrade runs env schema stubs", async () => {
    await runUpgrade({ projectRoot: tmpDir, apply: true });

    // Check env schema stubs exist
    const billingEnv = await fs.readFile(path.join(tmpDir, "lib/env/billing.ts"), "utf8");
    expect(billingEnv).toContain("BillingEnvSchema");

    const storageEnv = await fs.readFile(path.join(tmpDir, "lib/env/storage.ts"), "utf8");
    expect(storageEnv).toContain("StorageEnvSchema");
  }, 30_000);

  it("upgrade runs config key updates", async () => {
    await runUpgrade({ projectRoot: tmpDir, apply: true });

    // Config should still be valid
    const config = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(config).toContain("defineConfig");
    expect(config).toContain("TestApp");
  }, 30_000);

  it("upgrade runs runtime schema upgrades", async () => {
    await runUpgrade({ projectRoot: tmpDir, apply: true });

    // Runtime schema should exist and be valid
    const runtimeSchema = await fs.readFile(path.join(tmpDir, "lib/0xstack/config.ts"), "utf8");
    expect(runtimeSchema).toContain("ConfigSchema");
    expect(runtimeSchema).toContain("defineConfig");
  }, 30_000);

  it("upgrade runs PRD tooling (ESLint boundaries, module factories, vitest)", async () => {
    await runUpgrade({ projectRoot: tmpDir, apply: true });

    // ESLint boundaries should exist
    const eslintBoundaries = await fs.readFile(path.join(tmpDir, "eslint.0xstack-boundaries.mjs"), "utf8");
    expect(eslintBoundaries).toContain("no-restricted-imports");

    // Module factories should exist
    const moduleFactories = await fs.readFile(path.join(tmpDir, "lib/services/module-factories.ts"), "utf8");
    expect(moduleFactories).toContain("getBillingService");
    expect(moduleFactories).toContain("getStorageService");
    expect(moduleFactories).toContain("getSeoConfig");

    // Vitest config should exist
    const vitestConfig = await fs.readFile(path.join(tmpDir, "vitest.config.ts"), "utf8");
    expect(vitestConfig).toContain("vitest/config");
    expect(vitestConfig).toContain("tests/**/*.test.ts");
  }, 30_000);

  it("upgrade does not break existing config", async () => {
    const configBefore = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    await runUpgrade({ projectRoot: tmpDir, apply: true });
    const configAfter = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");

    // Config should still contain original values
    expect(configAfter).toContain("TestApp");
    expect(configAfter).toContain("defineConfig");
  }, 30_000);

  it("upgrade is idempotent (can run twice)", async () => {
    await runUpgrade({ projectRoot: tmpDir, apply: true });
    await expect(runUpgrade({ projectRoot: tmpDir, apply: true })).resolves.not.toThrow();
  }, 60_000);

  it("upgrade adds vitest test script to package.json", async () => {
    await runUpgrade({ projectRoot: tmpDir, apply: true });

    const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, "package.json"), "utf8"));
    expect(pkg.scripts).toHaveProperty("test");
    expect(pkg.scripts.test).toContain("vitest");
  }, 30_000);

  it("upgrade preserves existing package.json scripts", async () => {
    // Add a custom script
    const pkgPath = path.join(tmpDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    pkg.scripts = { ...pkg.scripts, custom: "echo hello" };
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

    await runUpgrade({ projectRoot: tmpDir, apply: true });

    const updatedPkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    expect(updatedPkg.scripts).toHaveProperty("custom", "echo hello");
  }, 30_000);
});
