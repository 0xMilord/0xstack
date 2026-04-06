import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execa } from "execa";

const pkgRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const cli = (...args: string[]) => execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), ...args], {
  cwd: pkgRoot,
  stdio: "pipe",
  timeout: 120_000,
});

describe("CLI Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-integration-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("init command", () => {
    it("rejects non-empty directory", async () => {
      await fs.writeFile(path.join(tmpDir, "existing.txt"), "hello", "utf8");
      await expect(cli("init", "--dir", tmpDir, "--yes")).rejects.toThrow();
    }, 30_000);

    it("rejects directory name starting with dot", async () => {
      const target = path.join(tmpDir, ".hidden");
      await expect(cli("init", "--dir", target, "--yes")).rejects.toThrow("Invalid project directory name");
    }, 30_000);

    it("generates 0xstack.config.ts with correct structure", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes", "--name", "TestApp", "--description", "A test app");
      const configContent = await fs.readFile(path.join(target, "0xstack.config.ts"), "utf8");
      expect(configContent).toContain("TestApp");
      expect(configContent).toContain("A test app");
      expect(configContent).toContain("defineConfig");
    }, 120_000);

    it("generates drizzle.config.ts with correct dialect", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const drizzleConfig = await fs.readFile(path.join(target, "drizzle.config.ts"), "utf8");
      expect(drizzleConfig).toContain("postgresql");
      expect(drizzleConfig).toContain("./lib/db/schema.ts");
    }, 120_000);

    it("generates lib/db/schema.ts with userProfiles table", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const schema = await fs.readFile(path.join(target, "lib/db/schema.ts"), "utf8");
      expect(schema).toContain("userProfiles");
      expect(schema).toContain("user_profiles");
    }, 120_000);

    it("generates lib/auth/auth.ts with better-auth", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const auth = await fs.readFile(path.join(target, "lib/auth/auth.ts"), "utf8");
      expect(auth).toContain("betterAuth");
      expect(auth).toContain("drizzleAdapter");
    }, 120_000);

    it("generates proxy.ts with security headers", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const proxy = await fs.readFile(path.join(target, "proxy.ts"), "utf8");
      expect(proxy).toContain("applySecurityHeaders");
      expect(proxy).toContain("buildCsp");
      expect(proxy).toContain("getOrCreateRequestId");
    }, 120_000);

    it("generates .env.example with required keys", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const env = await fs.readFile(path.join(target, ".env.example"), "utf8");
      expect(env).toContain("DATABASE_URL");
      expect(env).toContain("BETTER_AUTH_SECRET");
      expect(env).toContain("BETTER_AUTH_URL");
      expect(env).toContain("NEXT_PUBLIC_APP_URL");
    }, 120_000);

    it("generates lib/env/schema.ts with core env keys", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const schema = await fs.readFile(path.join(target, "lib/env/schema.ts"), "utf8");
      expect(schema).toContain("DATABASE_URL");
      expect(schema).toContain("BETTER_AUTH_SECRET");
      expect(schema).toContain("BillingEnvSchema");
      expect(schema).toContain("StorageEnvSchema");
    }, 120_000);

    it("generates lib/env/billing.ts with Dodo keys", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const billingEnv = await fs.readFile(path.join(target, "lib/env/billing.ts"), "utf8");
      expect(billingEnv).toContain("DODO_PAYMENTS_API_KEY");
      expect(billingEnv).toContain("DODO_PAYMENTS_WEBHOOK_KEY");
    }, 120_000);

    it("generates lib/env/storage.ts with GCS keys", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const storageEnv = await fs.readFile(path.join(target, "lib/env/storage.ts"), "utf8");
      expect(storageEnv).toContain("GCS_BUCKET");
      expect(storageEnv).toContain("GCS_PROJECT_ID");
    }, 120_000);

    it("generates lib/db/index.ts with postgres client", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const db = await fs.readFile(path.join(target, "lib/db/index.ts"), "utf8");
      expect(db).toContain("postgres");
      expect(db).toContain("drizzle");
    }, 120_000);

    it("generates lib/security/*.ts files", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const requestId = await fs.readFile(path.join(target, "lib/security/request-id.ts"), "utf8");
      expect(requestId).toContain("getOrCreateRequestId");
      const headers = await fs.readFile(path.join(target, "lib/security/headers.ts"), "utf8");
      expect(headers).toContain("applySecurityHeaders");
      const csp = await fs.readFile(path.join(target, "lib/security/csp.ts"), "utf8");
      expect(csp).toContain("buildCsp");
    }, 120_000);

    it("generates app/layout.tsx with root layout", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const layout = await fs.readFile(path.join(target, "app/layout.tsx"), "utf8");
      expect(layout).toContain("children");
    }, 120_000);

    it("generates app/app/layout.tsx with auth guard", async () => {
      const target = path.join(tmpDir, "test-app");
      await cli("init", "--dir", target, "--yes");
      const layout = await fs.readFile(path.join(target, "app/app/layout.tsx"), "utf8");
      expect(layout).toContain("requireAuth");
      expect(layout).toContain("AppShell");
    }, 120_000);
  });

  describe("baseline command", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "baseline-app");
      await cli("init", "--dir", target, "--yes");
    }, 120_000);

    it("generates Better Auth schema after baseline", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const schema = await fs.readFile(path.join(target, "lib/db/schema.ts"), "utf8");
      expect(schema).toContain("auth-schema");
      expect(schema).toContain("BETTER-AUTH-EXPORTS");
    }, 120_000);

    it("generates ESLint boundaries file", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const boundaries = await fs.readFile(path.join(target, "eslint.0xstack-boundaries.mjs"), "utf8");
      expect(boundaries).toContain("no-restricted-imports");
      expect(boundaries).toContain("@/lib/repos");
      expect(boundaries).toContain("@/lib/db");
    }, 120_000);

    it("generates module factories file", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const factories = await fs.readFile(path.join(target, "lib/services/module-factories.ts"), "utf8");
      expect(factories).toContain("getBillingService");
      expect(factories).toContain("getStorageService");
      expect(factories).toContain("getSeoConfig");
    }, 120_000);

    it("generates vitest config", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const vitestConfig = await fs.readFile(path.join(target, "vitest.config.ts"), "utf8");
      expect(vitestConfig).toContain("vitest/config");
      expect(vitestConfig).toContain("tests/**/*.test.ts");
    }, 120_000);

    it("generates query/mutation key indices", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const queryIndex = await fs.readFile(path.join(target, "lib/query-keys/index.ts"), "utf8");
      expect(queryIndex).toContain("auth.keys");
      expect(queryIndex).toContain("orgs.keys");
      const mutationIndex = await fs.readFile(path.join(target, "lib/mutation-keys/index.ts"), "utf8");
      expect(mutationIndex).toContain("auth.keys");
      expect(mutationIndex).toContain("orgs.keys");
    }, 120_000);

    it("generates auth pages (login, signup, forgot, reset)", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const login = await fs.readFile(path.join(target, "app/login/page.tsx"), "utf8");
      expect(login).toContain("authClient.signIn.email");
      const signup = await fs.readFile(path.join(target, "app/get-started/page.tsx"), "utf8");
      expect(signup).toContain("authClient.signUp.email");
      const forgot = await fs.readFile(path.join(target, "app/forgot-password/page.tsx"), "utf8");
      expect(forgot).toContain("requestPasswordReset");
      const reset = await fs.readFile(path.join(target, "app/reset-password/page.tsx"), "utf8");
      expect(reset).toContain("resetPassword");
    }, 120_000);

    it("generates auth API route", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const route = await fs.readFile(path.join(target, "app/api/auth/[...all]/route.ts"), "utf8");
      expect(route).toContain("auth.handler");
    }, 120_000);

    it("generates viewer loader and service", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const loader = await fs.readFile(path.join(target, "lib/loaders/viewer.loader.ts"), "utf8");
      expect(loader).toContain("withServerCache");
      expect(loader).toContain("cacheTags.viewer");
      const service = await fs.readFile(path.join(target, "lib/services/viewer.service.ts"), "utf8");
      expect(service).toContain("profilesService_ensureForUser");
    }, 120_000);

    it("generates orgs domain (repo, service, actions, loader, page)", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const repo = await fs.readFile(path.join(target, "lib/repos/orgs.repo.ts"), "utf8");
      expect(repo).toContain("insertOrg");
      const service = await fs.readFile(path.join(target, "lib/services/orgs.service.ts"), "utf8");
      expect(service).toContain("orgsService_createForUser");
      expect(service).toContain("orgsService_assertMember");
      const actions = await fs.readFile(path.join(target, "lib/actions/orgs.actions.ts"), "utf8");
      expect(actions).toContain("createOrg");
      expect(actions).toContain("setActiveOrg");
      const loader = await fs.readFile(path.join(target, "lib/loaders/orgs.loader.ts"), "utf8");
      expect(loader).toContain("loadMyOrgs");
      const page = await fs.readFile(path.join(target, "app/app/orgs/page.tsx"), "utf8");
      expect(page).toContain("createOrg");
      expect(page).toContain("setActiveOrg");
    }, 120_000);

    it("generates active-org backbone", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const activeOrg = await fs.readFile(path.join(target, "lib/orgs/active-org.ts"), "utf8");
      expect(activeOrg).toContain("requireActiveOrg");
      expect(activeOrg).toContain("getActiveOrgIdFromCookies");
      expect(activeOrg).toContain("setActiveOrgCookie");
      expect(activeOrg).toContain("ox_org");
    }, 120_000);

    it("generates security API (guard, repo, service, actions, loader, page)", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const guard = await fs.readFile(path.join(target, "lib/security/api.ts"), "utf8");
      expect(guard).toContain("guardApiRequest");
      expect(guard).toContain("toApiErrorResponse");
      const repo = await fs.readFile(path.join(target, "lib/repos/api-keys.repo.ts"), "utf8");
      expect(repo).toContain("findActiveApiKeysByPrefix");
      const service = await fs.readFile(path.join(target, "lib/services/api-keys.service.ts"), "utf8");
      expect(service).toContain("verifyApiKey");
      expect(service).toContain("apiKeysService_createForOrg");
      const page = await fs.readFile(path.join(target, "app/app/api-keys/page.tsx"), "utf8");
      expect(page).toContain("createApiKeyAction");
      expect(page).toContain("revokeApiKeyAction");
    }, 120_000);

    it("generates webhook ledger (repo, service, loader, actions, page, API)", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const repo = await fs.readFile(path.join(target, "lib/repos/webhook-events.repo.ts"), "utf8");
      expect(repo).toContain("upsertWebhookEvent");
      expect(repo).toContain("listWebhookEvents");
      const service = await fs.readFile(path.join(target, "lib/services/webhook-ledger.service.ts"), "utf8");
      expect(service).toContain("webhookLedgerService_replay");
      const page = await fs.readFile(path.join(target, "app/app/webhooks/page.tsx"), "utf8");
      expect(page).toContain("replayWebhookEventAction");
      const api = await fs.readFile(path.join(target, "app/api/v1/webhooks/ledger/events/route.ts"), "utf8");
      expect(api).toContain("guardApiRequest");
    }, 120_000);

    it("generates cache layer (config, lru, server, revalidate, index)", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const config = await fs.readFile(path.join(target, "lib/cache/config.ts"), "utf8");
      expect(config).toContain("CACHE_TTL");
      expect(config).toContain("cacheTags");
      expect(config).toContain("domainOrg");
      const lru = await fs.readFile(path.join(target, "lib/cache/lru.ts"), "utf8");
      expect(lru).toContain("l1GetOrSet");
      const server = await fs.readFile(path.join(target, "lib/cache/server.ts"), "utf8");
      expect(server).toContain("withServerCache");
      const revalidate = await fs.readFile(path.join(target, "lib/cache/revalidate.ts"), "utf8");
      expect(revalidate).toContain("billingForOrg");
      expect(revalidate).toContain("assetsForOrg");
    }, 120_000);

    it("generates UI foundation (header, footer, theme toggle, providers, app shell, settings)", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const header = await fs.readFile(path.join(target, "components/layout/site-header.tsx"), "utf8");
      expect(header).toContain("loadViewer");
      expect(header).toContain("getConfig");
      const footer = await fs.readFile(path.join(target, "components/layout/site-footer.tsx"), "utf8");
      expect(footer).toContain("SiteFooter");
      const providers = await fs.readFile(path.join(target, "app/providers.tsx"), "utf8");
      expect(providers).toContain("ThemeProvider");
      expect(providers).toContain("QueryClientProvider");
      const settings = await fs.readFile(path.join(target, "app/app/settings/page.tsx"), "utf8");
      expect(settings).toContain("loadViewer");
      expect(settings).toContain("getConfig");
    }, 120_000);

    it("patches root layout with Providers, SiteHeader, SiteFooter", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const layout = await fs.readFile(path.join(target, "app/layout.tsx"), "utf8");
      expect(layout).toContain("0xstack:UI-FOUNDATION");
      expect(layout).toContain("Providers");
      expect(layout).toContain("SiteHeader");
      expect(layout).toContain("SiteFooter");
    }, 120_000);

    it("generates health API route", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const health = await fs.readFile(path.join(target, "app/api/v1/health/route.ts"), "utf8");
      expect(health).toContain("ok: true");
      expect(health).toContain("hasDatabaseUrl");
    }, 120_000);

    it("generates drizzle migrations", async () => {
      await cli("baseline", "--dir", target, "--profile", "core");
      const journalPath = path.join(target, "drizzle", "migrations", "meta", "_journal.json");
      const journalExists = await fs.access(journalPath).then(() => true).catch(() => false);
      expect(journalExists).toBe(true);
    }, 120_000);
  });

  describe("doctor command", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "doctor-app");
      await cli("init", "--dir", target, "--yes");
      await cli("baseline", "--dir", target, "--profile", "core");
    }, 240_000);

    it("passes on clean baseline app", async () => {
      const { stdout } = await cli("doctor", "--dir", target, "--profile", "core");
      expect(stdout).toContain("Health Score");
      // Should not have critical issues
      expect(stdout).not.toContain("critical");
    }, 120_000);

    it("detects missing env vars", async () => {
      // Remove DATABASE_URL from .env.example to trigger detection
      const envPath = path.join(target, ".env.example");
      await fs.writeFile(envPath, "BETTER_AUTH_SECRET=short\n", "utf8");
      const { stdout } = await cli("doctor", "--dir", target, "--profile", "core");
      // Doctor should report missing env vars
      expect(stdout).toMatch(/missing|env|BETTER_AUTH_SECRET/i);
    }, 120_000);

    it("detects architecture boundary violations", async () => {
      // Create a file that imports repos from app/
      const violatingFile = path.join(target, "app", "api", "v1", "bad", "route.ts");
      await fs.mkdir(path.dirname(violatingFile), { recursive: true });
      await fs.writeFile(violatingFile, `import { db } from "@/lib/db";\nexport async function GET() { return new Response("bad"); }\n`, "utf8");
      const { stdout } = await cli("doctor", "--dir", target, "--profile", "core");
      expect(stdout).toMatch(/boundary|lib\/db|Architecture/i);
    }, 120_000);

    it("detects CQRS purity violations (loader importing actions)", async () => {
      const violatingLoader = path.join(target, "lib", "loaders", "bad.loader.ts");
      await fs.writeFile(violatingLoader, `import { someAction } from "@/lib/actions/orgs.actions";\nexport const loadBad = async () => { someAction(); };\n`, "utf8");
      const { stdout } = await cli("doctor", "--dir", target, "--profile", "core");
      expect(stdout).toMatch(/loader.*action|action.*loader|purity|Architecture/i);
    }, 120_000);

    it("detects missing required files", async () => {
      // Remove a required file
      await fs.unlink(path.join(target, "lib/orgs/active-org.ts"));
      const { stdout } = await cli("doctor", "--dir", target, "--profile", "core");
      expect(stdout).toMatch(/missing|active-org|foundation/i);
    }, 120_000);

    it("detects missing deps", async () => {
      // Remove a dep from package.json
      const pkgPath = path.join(target, "package.json");
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
      delete pkg.dependencies["better-auth"];
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
      const { stdout } = await cli("doctor", "--dir", target, "--profile", "core");
      expect(stdout).toMatch(/missing.*dep|better-auth|Dependencies/i);
    }, 120_000);
  });

  describe("generate domain command", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "generate-app");
      await cli("init", "--dir", target, "--yes");
      await cli("baseline", "--dir", target, "--profile", "core");
    }, 240_000);

    it("generates full CQRS slice for a domain", async () => {
      await cli("generate", "posts", "--dir", target);
      // Repo
      const repo = await fs.readFile(path.join(target, "lib/repos/posts.repo.ts"), "utf8");
      expect(repo).toContain("getPostsById");
      expect(repo).toContain("listPosts");
      expect(repo).toContain("insertPosts");
      expect(repo).toContain("updatePosts");
      expect(repo).toContain("deletePosts");
      // Service
      const service = await fs.readFile(path.join(target, "lib/services/posts.service.ts"), "utf8");
      expect(service).toContain("postsService_list");
      expect(service).toContain("postsService_create");
      // Loader
      const loader = await fs.readFile(path.join(target, "lib/loaders/posts.loader.ts"), "utf8");
      expect(loader).toContain("loadPostsList");
      expect(loader).toContain("requireAuth");
      expect(loader).toContain("getActiveOrgIdFromCookies");
      expect(loader).toContain("domainOrg");
      // Rules
      const rules = await fs.readFile(path.join(target, "lib/rules/posts.rules.ts"), "utf8");
      expect(rules).toContain("createPostsInput");
      expect(rules).toContain("z.object");
      // Actions
      const actions = await fs.readFile(path.join(target, "lib/actions/posts.actions.ts"), "utf8");
      expect(actions).toContain("createPosts");
      expect(actions).toContain("no_active_org");
      // Keys
      const queryKeys = await fs.readFile(path.join(target, "lib/query-keys/posts.keys.ts"), "utf8");
      expect(queryKeys).toContain("postsKeys");
      const mutationKeys = await fs.readFile(path.join(target, "lib/mutation-keys/posts.mutations.ts"), "utf8");
      expect(mutationKeys).toContain("postsMutations");
      // UI
      const page = await fs.readFile(path.join(target, "app/app/posts/page.tsx"), "utf8");
      expect(page).toContain("loadPostsList");
      expect(page).toContain("createPosts");
      // Schema
      const schema = await fs.readFile(path.join(target, "lib/db/schema.ts"), "utf8");
      expect(schema).toContain("posts");
      // Tests
      const repoTest = await fs.readFile(path.join(target, "tests/posts/posts.repo.test.ts"), "utf8");
      expect(repoTest).toContain("has all CRUD exports");
      const rulesTest = await fs.readFile(path.join(target, "tests/posts/posts.rules.test.ts"), "utf8");
      expect(rulesTest).toContain("validates create input with valid data");
      expect(rulesTest).toContain("rejects create input with empty name");
      const actionsTest = await fs.readFile(path.join(target, "tests/posts/posts.actions.test.ts"), "utf8");
      expect(actionsTest).toContain("service has all CRUD methods");
      expect(actionsTest).toContain("loader imports from service (not repo)");
    }, 120_000);

    it("generates API routes and hooks with --with-api flag", async () => {
      await cli("generate", "comments", "--dir", target, "--with-api");
      // API route
      const apiRoute = await fs.readFile(path.join(target, "app/api/v1/comments/route.ts"), "utf8");
      expect(apiRoute).toContain("guardApiRequest");
      expect(apiRoute).toContain("toApiErrorResponse");
      // Client hooks
      const hooks = await fs.readFile(path.join(target, "lib/hooks/client/use-comments.client.ts"), "utf8");
      expect(hooks).toContain("useCommentsList");
      expect(hooks).toContain("useCreateComments");
      expect(hooks).toContain("useQuery");
      expect(hooks).toContain("useMutation");
    }, 120_000);

    it("does NOT generate API routes without --with-api flag", async () => {
      await cli("generate", "tags", "--dir", target);
      const apiRouteExists = await fs.access(path.join(target, "app/api/v1/tags/route.ts")).then(() => true).catch(() => false);
      expect(apiRouteExists).toBe(false);
      const hooksExist = await fs.access(path.join(target, "lib/hooks/client/use-tags.client.ts")).then(() => true).catch(() => false);
      expect(hooksExist).toBe(false);
    }, 120_000);

    it("normalizes domain names (camelCase, PascalCase, spaces)", async () => {
      await cli("generate", "BlogPosts", "--dir", target);
      const repoExists = await fs.access(path.join(target, "lib/repos/blog-posts.repo.ts")).then(() => true).catch(() => false);
      expect(repoExists).toBe(true);
      const pageExists = await fs.access(path.join(target, "app/app/blog-posts/page.tsx")).then(() => true).catch(() => false);
      expect(pageExists).toBe(true);
    }, 120_000);
  });

  describe("add module command", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "add-app");
      await cli("init", "--dir", target, "--yes");
      await cli("baseline", "--dir", target, "--profile", "core");
    }, 240_000);

    it("enables SEO module and runs baseline", async () => {
      await cli("add", "seo", "--dir", target);
      // Check config was updated
      const config = await fs.readFile(path.join(target, "0xstack.config.ts"), "utf8");
      expect(config).toContain("seo: true");
      // Check SEO files were generated
      const robotsExists = await fs.access(path.join(target, "app/robots.ts")).then(() => true).catch(() => false);
      expect(robotsExists).toBe(true);
      const sitemapExists = await fs.access(path.join(target, "app/sitemap.ts")).then(() => true).catch(() => false);
      expect(sitemapExists).toBe(true);
      const jsonldExists = await fs.access(path.join(target, "lib/seo/jsonld.ts")).then(() => true).catch(() => false);
      expect(jsonldExists).toBe(true);
    }, 120_000);

    it("enables blog module and runs baseline", async () => {
      await cli("add", "blogMdx", "--dir", target);
      const config = await fs.readFile(path.join(target, "0xstack.config.ts"), "utf8");
      expect(config).toContain("blogMdx: true");
      const blogPageExists = await fs.access(path.join(target, "app/blog/page.tsx")).then(() => true).catch(() => false);
      expect(blogPageExists).toBe(true);
      const blogLoaderExists = await fs.access(path.join(target, "lib/loaders/blog.loader.ts")).then(() => true).catch(() => false);
      expect(blogLoaderExists).toBe(true);
    }, 120_000);

    it("rejects invalid module ID", async () => {
      await expect(cli("add", "nonexistent-module", "--dir", target)).rejects.toThrow();
    }, 120_000);
  });

  describe("module disable cleanup", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "disable-app");
      await cli("init", "--dir", target, "--yes");
      await cli("baseline", "--dir", target, "--profile", "full");
    }, 240_000);

    it("removes SEO files when disabled", async () => {
      // First verify SEO files exist
      expect(await fs.access(path.join(target, "app/robots.ts")).then(() => true).catch(() => false)).toBe(true);
      // Disable SEO
      const configPath = path.join(target, "0xstack.config.ts");
      let config = await fs.readFile(configPath, "utf8");
      config = config.replace("seo: true", "seo: false");
      await fs.writeFile(configPath, config, "utf8");
      await cli("baseline", "--dir", target, "--profile", "core");
      // Verify SEO files removed
      const robotsExists = await fs.access(path.join(target, "app/robots.ts")).then(() => true).catch(() => false);
      expect(robotsExists).toBe(false);
    }, 120_000);

    it("removes blog files when disabled", async () => {
      expect(await fs.access(path.join(target, "app/blog/page.tsx")).then(() => true).catch(() => false)).toBe(true);
      const configPath = path.join(target, "0xstack.config.ts");
      let config = await fs.readFile(configPath, "utf8");
      config = config.replace("blogMdx: true", "blogMdx: false");
      await fs.writeFile(configPath, config, "utf8");
      await cli("baseline", "--dir", target, "--profile", "core");
      const blogExists = await fs.access(path.join(target, "app/blog/page.tsx")).then(() => true).catch(() => false);
      expect(blogExists).toBe(false);
    }, 120_000);

    it("removes billing files when disabled", async () => {
      expect(await fs.access(path.join(target, "app/pricing/page.tsx")).then(() => true).catch(() => false)).toBe(true);
      const configPath = path.join(target, "0xstack.config.ts");
      let config = await fs.readFile(configPath, "utf8");
      config = config.replace('billing: "dodo"', "billing: false");
      await fs.writeFile(configPath, config, "utf8");
      await cli("baseline", "--dir", target, "--profile", "core");
      const pricingExists = await fs.access(path.join(target, "app/pricing/page.tsx")).then(() => true).catch(() => false);
      expect(pricingExists).toBe(false);
    }, 120_000);

    it("leaves shared libs intact when module disabled", async () => {
      // Disable blog but verify orgs still work
      const configPath = path.join(target, "0xstack.config.ts");
      let config = await fs.readFile(configPath, "utf8");
      config = config.replace("blogMdx: true", "blogMdx: false");
      await fs.writeFile(configPath, config, "utf8");
      await cli("baseline", "--dir", target, "--profile", "core");
      // Orgs should still exist
      const orgsRepoExists = await fs.access(path.join(target, "lib/repos/orgs.repo.ts")).then(() => true).catch(() => false);
      expect(orgsRepoExists).toBe(true);
      const activeOrgExists = await fs.access(path.join(target, "lib/orgs/active-org.ts")).then(() => true).catch(() => false);
      expect(activeOrgExists).toBe(true);
    }, 120_000);
  });

  describe("config commands", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "config-app");
      await cli("init", "--dir", target, "--yes");
    }, 120_000);

    it("config-print outputs valid JSON with all fields", async () => {
      const { stdout } = await cli("config-print", "--dir", target);
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty("app");
      expect(parsed).toHaveProperty("modules");
      expect(parsed.app).toHaveProperty("name");
      expect(parsed.modules).toHaveProperty("auth");
      expect(parsed.modules).toHaveProperty("orgs");
      expect(parsed.modules).toHaveProperty("billing");
      expect(parsed.modules).toHaveProperty("storage");
    }, 60_000);

    it("config-validate passes on valid config", async () => {
      const { exitCode } = await cli("config-validate", "--dir", target);
      expect(exitCode).toBe(0);
    }, 60_000);
  });

  describe("deps command", () => {
    let target: string;

    beforeEach(async () => {
      target = path.join(tmpDir, "deps-app");
      await cli("init", "--dir", target, "--yes");
    }, 120_000);

    it("deps outputs sorted dependency list", async () => {
      const { stdout } = await cli("deps", "--dir", target);
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty("deps");
      expect(parsed).toHaveProperty("devDeps");
      expect(Array.isArray(parsed.deps)).toBe(true);
      expect(Array.isArray(parsed.devDeps)).toBe(true);
      // Should be sorted
      expect(parsed.deps).toEqual([...parsed.deps].sort());
    }, 60_000);

    it("deps --cli outputs CLI dependencies", async () => {
      const { stdout } = await cli("deps", "--cli");
      expect(stdout).toContain("cac");
      expect(stdout).toContain("chalk");
    }, 60_000);
  });
});
