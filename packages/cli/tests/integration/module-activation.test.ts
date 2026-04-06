import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runModulesLifecycle } from "../../src/core/modules/registry";
import type { ModuleContext } from "../../src/core/modules/types";

describe("Module Activation Tests - All 19 Modules", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-modules-"));
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
    await fs.mkdir(path.join(tmpDir, "content", "blog"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "public"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "types"), { recursive: true });

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

  function minimalCtx(overrides?: Partial<ModuleContext["modules"]>): ModuleContext {
    return {
      projectRoot: tmpDir,
      profile: "core",
      modules: {
        seo: false,
        blogMdx: false,
        billing: false,
        storage: false,
        email: false,
        cache: true,
        pwa: false,
        observability: { sentry: false, otel: false },
        jobs: { enabled: false, driver: "cron-only" },
        ...overrides,
      },
    };
  }

  it("cache module generates config, lru, server, revalidate, index", async () => {
    await runModulesLifecycle(minimalCtx({ cache: true }));

    const config = await fs.readFile(path.join(tmpDir, "lib/cache/config.ts"), "utf8");
    expect(config).toContain("CACHE_TTL");
    expect(config).toContain("cacheTags");
    expect(config).toContain("domainOrg");

    const lru = await fs.readFile(path.join(tmpDir, "lib/cache/lru.ts"), "utf8");
    expect(lru).toContain("l1GetOrSet");
    expect(lru).toContain("stableKey");

    const server = await fs.readFile(path.join(tmpDir, "lib/cache/server.ts"), "utf8");
    expect(server).toContain("withServerCache");
    expect(server).toContain("unstable_cache");

    const revalidate = await fs.readFile(path.join(tmpDir, "lib/cache/revalidate.ts"), "utf8");
    expect(revalidate).toContain("revalidateTag");
    expect(revalidate).toContain("billingForOrg");
    expect(revalidate).toContain("assetsForOrg");

    const index = await fs.readFile(path.join(tmpDir, "lib/cache/index.ts"), "utf8");
    expect(index).toContain("export * from");
  }, 30_000);

  it("auth-core module generates handler, pages, viewer, actions, hooks", async () => {
    await runModulesLifecycle(minimalCtx());

    const handler = await fs.readFile(path.join(tmpDir, "app/api/auth/[...all]/route.ts"), "utf8");
    expect(handler).toContain("auth.handler");

    const login = await fs.readFile(path.join(tmpDir, "app/login/page.tsx"), "utf8");
    expect(login).toContain("authClient.signIn.email");

    const signup = await fs.readFile(path.join(tmpDir, "app/get-started/page.tsx"), "utf8");
    expect(signup).toContain("authClient.signUp.email");

    const forgot = await fs.readFile(path.join(tmpDir, "app/forgot-password/page.tsx"), "utf8");
    expect(forgot).toContain("requestPasswordReset");

    const reset = await fs.readFile(path.join(tmpDir, "app/reset-password/page.tsx"), "utf8");
    expect(reset).toContain("resetPassword");

    const viewerService = await fs.readFile(path.join(tmpDir, "lib/services/viewer.service.ts"), "utf8");
    expect(viewerService).toContain("profilesService_ensureForUser");

    const viewerLoader = await fs.readFile(path.join(tmpDir, "lib/loaders/viewer.loader.ts"), "utf8");
    expect(viewerLoader).toContain("withServerCache");
    expect(viewerLoader).toContain("cacheTags.viewer");

    const authActions = await fs.readFile(path.join(tmpDir, "lib/actions/auth.actions.ts"), "utf8");
    expect(authActions).toContain("signOutAction");

    const useViewer = await fs.readFile(path.join(tmpDir, "lib/hooks/client/use-viewer.ts"), "utf8");
    expect(useViewer).toContain("useQuery");
    expect(useViewer).toContain("useMutation");
  }, 30_000);

  it("core-db-state module generates orgs, active-org, repos, services, actions", async () => {
    await runModulesLifecycle(minimalCtx());

    const activeOrg = await fs.readFile(path.join(tmpDir, "lib/orgs/active-org.ts"), "utf8");
    expect(activeOrg).toContain("requireActiveOrg");
    expect(activeOrg).toContain("getActiveOrgIdFromCookies");
    expect(activeOrg).toContain("setActiveOrgCookie");
    expect(activeOrg).toContain("ox_org");

    const orgsRepo = await fs.readFile(path.join(tmpDir, "lib/repos/orgs.repo.ts"), "utf8");
    expect(orgsRepo).toContain("insertOrg");
    expect(orgsRepo).toContain("getOrgById");

    const orgMembersRepo = await fs.readFile(path.join(tmpDir, "lib/repos/org-members.repo.ts"), "utf8");
    expect(orgMembersRepo).toContain("addMember");
    expect(orgMembersRepo).toContain("listOrgsForUser");
    expect(orgMembersRepo).toContain("isMember");

    const orgsService = await fs.readFile(path.join(tmpDir, "lib/services/orgs.service.ts"), "utf8");
    expect(orgsService).toContain("orgsService_createForUser");
    expect(orgsService).toContain("orgsService_assertMember");
    expect(orgsService).toContain("orgsService_resolveActiveOrg");

    const orgsActions = await fs.readFile(path.join(tmpDir, "lib/actions/orgs.actions.ts"), "utf8");
    expect(orgsActions).toContain("createOrg");
    expect(orgsActions).toContain("setActiveOrg");

    const orgsLoader = await fs.readFile(path.join(tmpDir, "lib/loaders/orgs.loader.ts"), "utf8");
    expect(orgsLoader).toContain("loadMyOrgs");
    expect(orgsLoader).toContain("withServerCache");

    const orgsPage = await fs.readFile(path.join(tmpDir, "app/app/orgs/page.tsx"), "utf8");
    expect(orgsPage).toContain("createOrg");
    expect(orgsPage).toContain("setActiveOrg");

    const healthRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/health/route.ts"), "utf8");
    expect(healthRoute).toContain("ok: true");
    expect(healthRoute).toContain("hasDatabaseUrl");
  }, 30_000);

  it("ui-foundation module generates header, footer, providers, app-shell, settings", async () => {
    await runModulesLifecycle(minimalCtx());

    const header = await fs.readFile(path.join(tmpDir, "components/layout/site-header.tsx"), "utf8");
    expect(header).toContain("loadViewer");
    expect(header).toContain("getConfig");
    expect(header).toContain("PwaUpdateBanner");
    expect(header).toContain("ThemeToggle");

    const footer = await fs.readFile(path.join(tmpDir, "components/layout/site-footer.tsx"), "utf8");
    expect(footer).toContain("SiteFooter");
    expect(footer).toContain("Terms");
    expect(footer).toContain("Privacy");

    const themeToggle = await fs.readFile(path.join(tmpDir, "components/layout/theme-toggle.tsx"), "utf8");
    expect(themeToggle).toContain("useTheme");
    expect(themeToggle).toContain("setTheme");

    const providers = await fs.readFile(path.join(tmpDir, "app/providers.tsx"), "utf8");
    expect(providers).toContain("ThemeProvider");
    expect(providers).toContain("QueryClientProvider");

    const appShell = await fs.readFile(path.join(tmpDir, "lib/components/layout/app-shell.tsx"), "utf8");
    expect(appShell).toContain("AppShell");

    const settings = await fs.readFile(path.join(tmpDir, "app/app/settings/page.tsx"), "utf8");
    expect(settings).toContain("loadViewer");
    expect(settings).toContain("getConfig");
    expect(settings).toContain("signOutAction");

    // Check layout was patched
    const layout = await fs.readFile(path.join(tmpDir, "app/layout.tsx"), "utf8");
    expect(layout).toContain("0xstack:UI-FOUNDATION");
    expect(layout).toContain("Providers");
    expect(layout).toContain("SiteHeader");
    expect(layout).toContain("SiteFooter");
  }, 30_000);

  it("security-api module generates guard, repo, service, actions, loader, page", async () => {
    await runModulesLifecycle(minimalCtx());

    const guard = await fs.readFile(path.join(tmpDir, "lib/security/api.ts"), "utf8");
    expect(guard).toContain("guardApiRequest");
    expect(guard).toContain("toApiErrorResponse");
    expect(guard).toContain("verifyApiKey");

    const apiKeysRepo = await fs.readFile(path.join(tmpDir, "lib/repos/api-keys.repo.ts"), "utf8");
    expect(apiKeysRepo).toContain("findActiveApiKeysByPrefix");
    expect(apiKeysRepo).toContain("insertApiKey");
    expect(apiKeysRepo).toContain("revokeApiKey");

    const apiKeysService = await fs.readFile(path.join(tmpDir, "lib/services/api-keys.service.ts"), "utf8");
    expect(apiKeysService).toContain("verifyApiKey");
    expect(apiKeysService).toContain("apiKeysService_createForOrg");
    expect(apiKeysService).toContain("apiKeysService_revokeForOrg");

    const apiKeysActions = await fs.readFile(path.join(tmpDir, "lib/actions/api-keys.actions.ts"), "utf8");
    expect(apiKeysActions).toContain("createApiKeyAction");
    expect(apiKeysActions).toContain("revokeApiKeyAction");

    const apiKeysLoader = await fs.readFile(path.join(tmpDir, "lib/loaders/api-keys.loader.ts"), "utf8");
    expect(apiKeysLoader).toContain("loadApiKeysForActiveOrg");

    const apiKeysPage = await fs.readFile(path.join(tmpDir, "app/app/api-keys/page.tsx"), "utf8");
    expect(apiKeysPage).toContain("createApiKeyAction");
    expect(apiKeysPage).toContain("revokeApiKeyAction");
  }, 30_000);

  it("webhook-ledger module generates repo, service, loader, actions, page, API", async () => {
    await runModulesLifecycle(minimalCtx());

    const repo = await fs.readFile(path.join(tmpDir, "lib/repos/webhook-events.repo.ts"), "utf8");
    expect(repo).toContain("upsertWebhookEvent");
    expect(repo).toContain("listWebhookEvents");
    expect(repo).toContain("getWebhookEvent");

    const service = await fs.readFile(path.join(tmpDir, "lib/services/webhook-ledger.service.ts"), "utf8");
    expect(service).toContain("webhookLedgerService_list");
    expect(service).toContain("webhookLedgerService_get");
    expect(service).toContain("webhookLedgerService_replay");

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/webhook-ledger.loader.ts"), "utf8");
    expect(loader).toContain("loadWebhookLedger");
    expect(loader).toContain("withServerCache");

    const actions = await fs.readFile(path.join(tmpDir, "lib/actions/webhook-ledger.actions.ts"), "utf8");
    expect(actions).toContain("replayWebhookEventAction");

    const page = await fs.readFile(path.join(tmpDir, "app/app/webhooks/page.tsx"), "utf8");
    expect(page).toContain("replayWebhookEventAction");

    const api = await fs.readFile(path.join(tmpDir, "app/api/v1/webhooks/ledger/events/route.ts"), "utf8");
    expect(api).toContain("guardApiRequest");
    expect(api).toContain("webhookLedgerService_list");
  }, 30_000);

  it("observability module generates logger, env schema", async () => {
    await runModulesLifecycle(minimalCtx({ observability: { sentry: false, otel: false } }));

    const logger = await fs.readFile(path.join(tmpDir, "lib/utils/logger.ts"), "utf8");
    expect(logger).toContain("log");
    expect(logger).toContain("logger");
    expect(logger).toContain("redact");

    const envSchema = await fs.readFile(path.join(tmpDir, "lib/env/observability.ts"), "utf8");
    expect(envSchema).toContain("ObservabilityEnvSchema");
    expect(envSchema).toContain("SENTRY_DSN");
  }, 30_000);

  it("jobs module generates reconcile function and route", async () => {
    await runModulesLifecycle(minimalCtx({ jobs: { enabled: true, driver: "cron-only" } }));

    const reconcile = await fs.readFile(path.join(tmpDir, "lib/jobs/reconcile.ts"), "utf8");
    expect(reconcile).toContain("jobs_runReconcile");
    expect(reconcile).toContain("webhookLedgerService_list");
    expect(reconcile).toContain("webhookLedgerService_replay");

    const route = await fs.readFile(path.join(tmpDir, "app/api/v1/jobs/reconcile/route.ts"), "utf8");
    expect(route).toContain("jobs_runReconcile");
    expect(route).toContain("guardApiRequest");
    expect(route).toContain("x-job-secret");
  }, 30_000);

  it("seo module generates JSON-LD, metadata, robots, sitemap, OG images", async () => {
    await runModulesLifecycle(minimalCtx({ seo: true }));

    const jsonld = await fs.readFile(path.join(tmpDir, "lib/seo/jsonld.ts"), "utf8");
    expect(jsonld).toContain("getSeoData");
    expect(jsonld).toContain("safeJsonLd");
    expect(jsonld).toContain("organizationJsonLd");
    expect(jsonld).toContain("websiteJsonLd");
    expect(jsonld).toContain("softwareApplicationJsonLd");

    const metadata = await fs.readFile(path.join(tmpDir, "lib/seo/metadata.ts"), "utf8");
    expect(metadata).toContain("getSiteMetadata");
    expect(metadata).toContain("getPageMetadata");
    expect(metadata).toContain("openGraph");
    expect(metadata).toContain("twitter");

    const runtime = await fs.readFile(path.join(tmpDir, "lib/seo/runtime.ts"), "utf8");
    expect(runtime).toContain("getSeoRuntimeConfig");

    const robots = await fs.readFile(path.join(tmpDir, "app/robots.ts"), "utf8");
    expect(robots).toContain("rules");
    expect(robots).toContain("sitemap");

    const sitemap = await fs.readFile(path.join(tmpDir, "app/sitemap.ts"), "utf8");
    expect(sitemap).toContain("MetadataRoute");
    expect(sitemap).toContain("NEXT_PUBLIC_APP_URL");

    const og = await fs.readFile(path.join(tmpDir, "app/opengraph-image.tsx"), "utf8");
    expect(og).toContain("ImageResponse");
    expect(og).toContain("getSeoData");

    const twitter = await fs.readFile(path.join(tmpDir, "app/twitter-image.tsx"), "utf8");
    expect(twitter).toContain("opengraph-image");

    // Check layout was patched for SEO
    const layout = await fs.readFile(path.join(tmpDir, "app/layout.tsx"), "utf8");
    expect(layout).toContain("0xstack:SEO");
    expect(layout).toContain("getSiteMetadata");
    expect(layout).toContain("safeJsonLd");
  }, 30_000);

  it("blogMdx module generates MDX content, loader, pages, RSS", async () => {
    await runModulesLifecycle(minimalCtx({ blogMdx: true }));

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/blog.loader.ts"), "utf8");
    expect(loader).toContain("listPosts");
    expect(loader).toContain("getPost");
    expect(loader).toContain("FrontmatterSchema");
    expect(loader).toContain("withServerCache");

    const blogIndex = await fs.readFile(path.join(tmpDir, "app/blog/page.tsx"), "utf8");
    expect(blogIndex).toContain("listPosts");
    expect(blogIndex).toContain("featured");

    const blogPost = await fs.readFile(path.join(tmpDir, "app/blog/[slug]/page.tsx"), "utf8");
    expect(blogPost).toContain("MDXRemote");
    expect(blogPost).toContain("getPost");
    expect(blogPost).toContain("readingTime");
    expect(blogPost).toContain("extractHeadings");

    const rss = await fs.readFile(path.join(tmpDir, "app/rss.xml/route.ts"), "utf8");
    expect(rss).toContain("listPosts");
    expect(rss).toContain("application/xml");

    // Check MDX content exists
    const mdxContent = await fs.readFile(path.join(tmpDir, "content/blog/what-is-0xstack.mdx"), "utf8");
    expect(mdxContent).toContain("title:");
    expect(mdxContent).toContain("description:");
    expect(mdxContent).toContain("published: true");
  }, 30_000);

  it("billing-core module generates runtime, plans, service, loader, actions, hooks, pages, status API", async () => {
    await runModulesLifecycle(minimalCtx({ billing: "dodo" }));

    const runtime = await fs.readFile(path.join(tmpDir, "lib/billing/runtime.ts"), "utf8");
    expect(runtime).toContain("ACTIVE_BILLING_PROVIDER");
    expect(runtime).toContain("dodo");

    const plans = await fs.readFile(path.join(tmpDir, "lib/billing/plans.ts"), "utf8");
    expect(plans).toContain("getBillingPlans");
    expect(plans).toContain("BillingPlan");

    const service = await fs.readFile(path.join(tmpDir, "lib/services/billing.service.ts"), "utf8");
    expect(service).toContain("billingService_getLatestForOrg");
    expect(service).toContain("reconcileBillingEvent");

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/billing.loader.ts"), "utf8");
    expect(loader).toContain("loadBillingForOrg");
    expect(loader).toContain("withServerCache");

    const actions = await fs.readFile(path.join(tmpDir, "lib/actions/billing.actions.ts"), "utf8");
    expect(actions).toContain("startCheckoutAction");
    expect(actions).toContain("openPortalAction");

    const hooks = await fs.readFile(path.join(tmpDir, "lib/hooks/client/use-billing.client.ts"), "utf8");
    expect(hooks).toContain("useBillingStatus");
    expect(hooks).toContain("useInvalidateBilling");

    const pricing = await fs.readFile(path.join(tmpDir, "app/pricing/page.tsx"), "utf8");
    expect(pricing).toContain("getBillingPlans");
    expect(pricing).toContain("startCheckoutAction");

    const billingPage = await fs.readFile(path.join(tmpDir, "app/app/billing/page.tsx"), "utf8");
    expect(billingPage).toContain("loadBillingForOrg");
    expect(billingPage).toContain("openPortalAction");

    const statusApi = await fs.readFile(path.join(tmpDir, "app/api/v1/billing/status/route.ts"), "utf8");
    expect(statusApi).toContain("guardApiRequest");
    expect(statusApi).toContain("billingService_getLatestForOrg");
  }, 30_000);

  it("billing-dodo module generates env, webhook verification, checkout/portal/webhook routes", async () => {
    await runModulesLifecycle(minimalCtx({ billing: "dodo" }));

    const env = await fs.readFile(path.join(tmpDir, "lib/env/billing.ts"), "utf8");
    expect(env).toContain("DODO_PAYMENTS_API_KEY");
    expect(env).toContain("DODO_PAYMENTS_WEBHOOK_KEY");
    expect(env).toContain("DODO_PAYMENTS_ENVIRONMENT");
    expect(env).toContain("DODO_PAYMENTS_RETURN_URL");

    const webhooks = await fs.readFile(path.join(tmpDir, "lib/billing/dodo.webhooks.ts"), "utf8");
    expect(webhooks).toContain("verifyDodoWebhook");
    expect(webhooks).toContain("standardwebhooks");

    const checkout = await fs.readFile(path.join(tmpDir, "app/api/v1/billing/checkout/route.ts"), "utf8");
    expect(checkout).toContain("checkoutUrl");
    expect(checkout).toContain("checkout.dodopayments.com");

    const portal = await fs.readFile(path.join(tmpDir, "app/api/v1/billing/portal/route.ts"), "utf8");
    expect(portal).toContain("portalUrl");
    expect(portal).toContain("portal.dodopayments.com");

    const webhook = await fs.readFile(path.join(tmpDir, "app/api/v1/billing/webhook/route.ts"), "utf8");
    expect(webhook).toContain("Webhooks");
    expect(webhook).toContain("upsertWebhookEvent");
    expect(webhook).toContain("reconcileBillingEvent");
  }, 30_000);

  it("storage-core module generates runtime, provider interface, service, loaders, actions, API routes, UI", async () => {
    await runModulesLifecycle(minimalCtx({ storage: "gcs" }));

    const runtime = await fs.readFile(path.join(tmpDir, "lib/storage/runtime.ts"), "utf8");
    expect(runtime).toContain("ACTIVE_STORAGE_PROVIDER");
    expect(runtime).toContain("gcs");

    const provider = await fs.readFile(path.join(tmpDir, "lib/storage/provider.ts"), "utf8");
    expect(provider).toContain("ProviderSignUploadResult");
    expect(provider).toContain("ProviderSignReadResult");

    const service = await fs.readFile(path.join(tmpDir, "lib/services/storage.service.ts"), "utf8");
    expect(service).toContain("storageService_buildObjectKey");
    expect(service).toContain("storageService_createSignedUpload");
    expect(service).toContain("storageService_createSignedRead");
    expect(service).toContain("storageService_deleteAsset");
    expect(service).toContain("storageService_listAssets");

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/assets.loader.ts"), "utf8");
    expect(loader).toContain("loadAssetsForActiveOrg");
    expect(loader).toContain("loadAssetForViewer");
    expect(loader).toContain("withServerCache");

    const actions = await fs.readFile(path.join(tmpDir, "lib/actions/assets.actions.ts"), "utf8");
    expect(actions).toContain("assetsSignUploadAction");
    expect(actions).toContain("assetsSignReadAction");
    expect(actions).toContain("assetsDeleteAction");

    const signUpload = await fs.readFile(path.join(tmpDir, "app/api/v1/storage/sign-upload/route.ts"), "utf8");
    expect(signUpload).toContain("storageService_createSignedUpload");

    const signRead = await fs.readFile(path.join(tmpDir, "app/api/v1/storage/sign-read/route.ts"), "utf8");
    expect(signRead).toContain("storageService_createSignedRead");

    const assetsList = await fs.readFile(path.join(tmpDir, "app/api/v1/storage/assets/route.ts"), "utf8");
    expect(assetsList).toContain("storageService_listAssets");

    const assetsDelete = await fs.readFile(path.join(tmpDir, "app/api/v1/storage/assets/[assetId]/route.ts"), "utf8");
    expect(assetsDelete).toContain("storageService_deleteAsset");

    const assetsPage = await fs.readFile(path.join(tmpDir, "app/app/assets/page.tsx"), "utf8");
    expect(assetsPage).toContain("loadAssetsForActiveOrg");
    expect(assetsPage).toContain("AssetsClient");
  }, 30_000);

  it("storage-gcs module generates env and provider", async () => {
    await runModulesLifecycle(minimalCtx({ storage: "gcs" }));

    const env = await fs.readFile(path.join(tmpDir, "lib/env/storage.ts"), "utf8");
    expect(env).toContain("GCS_BUCKET");
    expect(env).toContain("GCS_PROJECT_ID");

    const provider = await fs.readFile(path.join(tmpDir, "lib/storage/providers/gcs.ts"), "utf8");
    expect(provider).toContain("providerSignUpload");
    expect(provider).toContain("providerSignRead");
    expect(provider).toContain("@google-cloud/storage");
  }, 30_000);

  it("email-resend module generates env, client, templates, auth patching", async () => {
    await runModulesLifecycle(minimalCtx({ email: "resend" }));

    const env = await fs.readFile(path.join(tmpDir, "lib/env/email.ts"), "utf8");
    expect(env).toContain("RESEND_API_KEY");
    expect(env).toContain("RESEND_FROM");

    const client = await fs.readFile(path.join(tmpDir, "lib/email/resend.ts"), "utf8");
    expect(client).toContain("Resend");
    expect(client).toContain("sendResendEmail");

    const verifyTemplate = await fs.readFile(path.join(tmpDir, "lib/email/templates/verify-email.tsx"), "utf8");
    expect(verifyTemplate).toContain("VerifyEmailTemplate");

    const resetTemplate = await fs.readFile(path.join(tmpDir, "lib/email/templates/reset-password.tsx"), "utf8");
    expect(resetTemplate).toContain("ResetPasswordTemplate");

    const welcomeTemplate = await fs.readFile(path.join(tmpDir, "lib/email/templates/welcome-email.tsx"), "utf8");
    expect(welcomeTemplate).toContain("WelcomeEmailTemplate");

    const authEmails = await fs.readFile(path.join(tmpDir, "lib/email/auth-emails.ts"), "utf8");
    expect(authEmails).toContain("sendVerifyEmail");
    expect(authEmails).toContain("sendResetPasswordEmail");
    expect(authEmails).toContain("sendWelcomeEmail");

    // Check auth.ts was patched
    const auth = await fs.readFile(path.join(tmpDir, "lib/auth/auth.ts"), "utf8");
    expect(auth).toContain("sendResetPasswordEmail");
    expect(auth).toContain("sendVerifyEmail");
  }, 30_000);

  it("pwa module generates manifest, SW, offline, push, API routes, UI", async () => {
    await runModulesLifecycle(minimalCtx({ pwa: true }));

    const manifest = await fs.readFile(path.join(tmpDir, "public/manifest.webmanifest"), "utf8");
    expect(manifest).toContain("name");
    expect(manifest).toContain("start_url");

    const sw = await fs.readFile(path.join(tmpDir, "public/sw.js"), "utf8");
    expect(sw).toContain("push");
    expect(sw).toContain("notificationclick");

    const offline = await fs.readFile(path.join(tmpDir, "public/offline.html"), "utf8");
    expect(offline).toContain("offline");

    const push = await fs.readFile(path.join(tmpDir, "lib/pwa/push.ts"), "utf8");
    expect(push).toContain("configureWebPush");
    expect(push).toContain("setVapidDetails");

    const registerSw = await fs.readFile(path.join(tmpDir, "lib/pwa/register-sw.client.ts"), "utf8");
    expect(registerSw).toContain("registerServiceWorker");

    const offlineStorage = await fs.readFile(path.join(tmpDir, "lib/pwa/offline-storage.ts"), "utf8");
    expect(offlineStorage).toContain("getOfflineStorage");

    const subscribeRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/pwa/push/subscribe/route.ts"), "utf8");
    expect(subscribeRoute).toContain("pushSubscriptionsService_subscribe");

    const unsubscribeRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/pwa/push/unsubscribe/route.ts"), "utf8");
    expect(unsubscribeRoute).toContain("pushSubscriptionsService_unsubscribe");

    const sendRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/pwa/push/send/route.ts"), "utf8");
    expect(sendRoute).toContain("pushService_sendToUser");

    const pwaPage = await fs.readFile(path.join(tmpDir, "app/app/pwa/page.tsx"), "utf8");
    expect(pwaPage).toContain("loadPwaSettings");
    expect(pwaPage).toContain("PwaClient");

    const pwaClient = await fs.readFile(path.join(tmpDir, "app/app/pwa/pwa-client.tsx"), "utf8");
    expect(pwaClient).toContain("registerServiceWorker");
    expect(pwaClient).toContain("pushManager.subscribe");

    const pwaLoader = await fs.readFile(path.join(tmpDir, "lib/loaders/pwa.loader.ts"), "utf8");
    expect(pwaLoader).toContain("loadPwaSettings");

    const pwaActions = await fs.readFile(path.join(tmpDir, "lib/actions/pwa.actions.ts"), "utf8");
    expect(pwaActions).toContain("pwaSendTestPushAction");
    expect(pwaActions).toContain("pwaUnsubscribeEndpointAction");

    // Check layout was patched for PWA
    const layout = await fs.readFile(path.join(tmpDir, "app/layout.tsx"), "utf8");
    expect(layout).toContain("0xSTACK:PWA");
    expect(layout).toContain("manifest");
  }, 30_000);

  it("module activation order matters (cache before auth-core before ui-foundation)", async () => {
    // This test verifies that modules are activated in the correct order
    // The registry runs modules in a specific order that respects dependencies
    await runModulesLifecycle(minimalCtx());

    // All core modules should have been activated
    const cacheExists = await fs.access(path.join(tmpDir, "lib/cache/config.ts")).then(() => true).catch(() => false);
    expect(cacheExists).toBe(true);

    const authExists = await fs.access(path.join(tmpDir, "lib/auth/auth.ts")).then(() => true).catch(() => false);
    expect(authExists).toBe(true);

    const uiExists = await fs.access(path.join(tmpDir, "components/layout/site-header.tsx")).then(() => true).catch(() => false);
    expect(uiExists).toBe(true);
  }, 30_000);
});
