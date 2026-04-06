import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runGenerateDomain } from "../../src/core/generate/run-generate-domain";

describe("Generate Domain Command - Full Flow Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-generate-flow-"));
    // Create minimal app structure
    await fs.mkdir(path.join(tmpDir, "lib", "db"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "repos"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "services"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "loaders"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "actions"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "rules"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "query-keys"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "mutation-keys"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "hooks", "client"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "orgs"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "auth"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "lib", "cache"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "app", "app"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "tests"), { recursive: true });

    // Write minimal required files
    await fs.writeFile(path.join(tmpDir, "lib/db/schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/orgs/active-org.ts"), `export function getActiveOrgIdFromCookies() { return null; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/auth/server.ts"), `export async function requireAuth() { return { userId: "1" }; }`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/services/orgs.service.ts"), `export async function orgsService_assertMember() {}`, "utf8");
    await fs.writeFile(path.join(tmpDir, "lib/cache/config.ts"), `export const CACHE_TTL = {}; export const cacheTags = { domainOrg: (d: string, o: string) => d + ":" + o };`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("generates full CQRS slice for a domain", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "posts", withApi: false });

    // Repo
    const repo = await fs.readFile(path.join(tmpDir, "lib/repos/posts.repo.ts"), "utf8");
    expect(repo).toContain("getPostsById");
    expect(repo).toContain("listPosts");
    expect(repo).toContain("insertPosts");
    expect(repo).toContain("updatePosts");
    expect(repo).toContain("deletePosts");

    // Service
    const service = await fs.readFile(path.join(tmpDir, "lib/services/posts.service.ts"), "utf8");
    expect(service).toContain("postsService_list");
    expect(service).toContain("postsService_create");
    expect(service).toContain("postsService_getById");
    expect(service).toContain("postsService_update");
    expect(service).toContain("postsService_delete");

    // Loader
    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/posts.loader.ts"), "utf8");
    expect(loader).toContain("loadPostsList");
    expect(loader).toContain("requireAuth");
    expect(loader).toContain("getActiveOrgIdFromCookies");
    expect(loader).toContain("orgsService_assertMember");
    expect(loader).toContain("domainOrg");

    // Rules
    const rules = await fs.readFile(path.join(tmpDir, "lib/rules/posts.rules.ts"), "utf8");
    expect(rules).toContain("createPostsInput");
    expect(rules).toContain("updatePostsInput");
    expect(rules).toContain("deletePostsInput");
    expect(rules).toContain("z.object");

    // Actions
    const actions = await fs.readFile(path.join(tmpDir, "lib/actions/posts.actions.ts"), "utf8");
    expect(actions).toContain("createPosts");
    expect(actions).toContain("updatePosts");
    expect(actions).toContain("deletePosts");
    expect(actions).toContain("listPostsForViewer");
    expect(actions).toContain("no_active_org");

    // Keys
    const queryKeys = await fs.readFile(path.join(tmpDir, "lib/query-keys/posts.keys.ts"), "utf8");
    expect(queryKeys).toContain("postsKeys");
    expect(queryKeys).toContain("all");
    expect(queryKeys).toContain("list");
    expect(queryKeys).toContain("detail");

    const mutationKeys = await fs.readFile(path.join(tmpDir, "lib/mutation-keys/posts.mutations.ts"), "utf8");
    expect(mutationKeys).toContain("postsMutations");
    expect(mutationKeys).toContain("create");

    // UI
    const page = await fs.readFile(path.join(tmpDir, "app/app/posts/page.tsx"), "utf8");
    expect(page).toContain("loadPostsList");
    expect(page).toContain("createPosts");

    // Schema
    const schema = await fs.readFile(path.join(tmpDir, "lib/db/schema.ts"), "utf8");
    expect(schema).toContain("posts");
    expect(schema).toContain("0xstack:SCHEMA-AUTO-START");

    // Tests
    const repoTest = await fs.readFile(path.join(tmpDir, "tests/posts/posts.repo.test.ts"), "utf8");
    expect(repoTest).toContain("has all CRUD exports");
    const rulesTest = await fs.readFile(path.join(tmpDir, "tests/posts/posts.rules.test.ts"), "utf8");
    expect(rulesTest).toContain("validates create input with valid data");
    expect(rulesTest).toContain("rejects create input with empty name");
    const actionsTest = await fs.readFile(path.join(tmpDir, "tests/posts/posts.actions.test.ts"), "utf8");
    expect(actionsTest).toContain("service has all CRUD methods");
    expect(actionsTest).toContain("loader imports from service (not repo)");
  }, 30_000);

  it("generates API routes and hooks with --with-api flag", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "comments", withApi: true });

    // API route
    const apiRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/comments/route.ts"), "utf8");
    expect(apiRoute).toContain("guardApiRequest");
    expect(apiRoute).toContain("toApiErrorResponse");
    expect(apiRoute).toContain("commentsService_list");

    // Client hooks
    const hooks = await fs.readFile(path.join(tmpDir, "lib/hooks/client/use-comments.client.ts"), "utf8");
    expect(hooks).toContain("useCommentsList");
    expect(hooks).toContain("useCreateComments");
    expect(hooks).toContain("useQuery");
    expect(hooks).toContain("useMutation");
    expect(hooks).toContain("invalidateQueries");
  }, 30_000);

  it("does NOT generate API routes without --with-api flag", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "tags", withApi: false });

    const apiRouteExists = await fs.access(path.join(tmpDir, "app/api/v1/tags/route.ts")).then(() => true).catch(() => false);
    expect(apiRouteExists).toBe(false);

    const hooksExist = await fs.access(path.join(tmpDir, "lib/hooks/client/use-tags.client.ts")).then(() => true).catch(() => false);
    expect(hooksExist).toBe(false);
  }, 30_000);

  it("normalizes domain names (camelCase, PascalCase, spaces)", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "BlogPosts", withApi: false });

    const repoExists = await fs.access(path.join(tmpDir, "lib/repos/blog-posts.repo.ts")).then(() => true).catch(() => false);
    expect(repoExists).toBe(true);

    const pageExists = await fs.access(path.join(tmpDir, "app/app/blog-posts/page.tsx")).then(() => true).catch(() => false);
    expect(pageExists).toBe(true);

    const serviceExists = await fs.access(path.join(tmpDir, "lib/services/blog-posts.service.ts")).then(() => true).catch(() => false);
    expect(serviceExists).toBe(true);
  }, 30_000);

  it("normalizes domain names (kebab-case)", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "user-profiles", withApi: false });

    const repoExists = await fs.access(path.join(tmpDir, "lib/repos/user-profiles.repo.ts")).then(() => true).catch(() => false);
    expect(repoExists).toBe(true);

    const pageExists = await fs.access(path.join(tmpDir, "app/app/user-profiles/page.tsx")).then(() => true).catch(() => false);
    expect(pageExists).toBe(true);
  }, 30_000);

  it("normalizes domain names (spaces)", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "user profiles", withApi: false });

    const repoExists = await fs.access(path.join(tmpDir, "lib/repos/user-profiles.repo.ts")).then(() => true).catch(() => false);
    expect(repoExists).toBe(true);
  }, 30_000);

  it("generates org-scoped repo methods", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "projects", withApi: false });

    const repo = await fs.readFile(path.join(tmpDir, "lib/repos/projects.repo.ts"), "utf8");
    expect(repo).toContain("orgId");
    expect(repo).toContain("eq(projects.orgId, input.orgId)");
  }, 30_000);

  it("generates org-scoped service methods", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "tasks", withApi: false });

    const service = await fs.readFile(path.join(tmpDir, "lib/services/tasks.service.ts"), "utf8");
    expect(service).toContain("orgId");
    expect(service).toContain("tasksService_list");
    expect(service).toContain("tasksService_create");
  }, 30_000);

  it("generates auth-gated loader", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "invoices", withApi: false });

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/invoices.loader.ts"), "utf8");
    expect(loader).toContain("requireAuth");
    expect(loader).toContain("getActiveOrgIdFromCookies");
    expect(loader).toContain("orgsService_assertMember");
  }, 30_000);

  it("generates auth-gated actions", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "orders", withApi: false });

    const actions = await fs.readFile(path.join(tmpDir, "lib/actions/orders.actions.ts"), "utf8");
    expect(actions).toContain("requireAuth");
    expect(actions).toContain("getActiveOrgIdFromCookies");
    expect(actions).toContain("orgsService_assertMember");
    expect(actions).toContain("no_active_org");
  }, 30_000);

  it("generates Zod validation rules", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "products", withApi: false });

    const rules = await fs.readFile(path.join(tmpDir, "lib/rules/products.rules.ts"), "utf8");
    expect(rules).toContain("z.object");
    expect(rules).toContain("createProductsInput");
    expect(rules).toContain("updateProductsInput");
    expect(rules).toContain("deleteProductsInput");
    expect(rules).toContain("z.string().min(1)");
  }, 30_000);

  it("generates cache-tagged loader", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "categories", withApi: false });

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/categories.loader.ts"), "utf8");
    expect(loader).toContain("withServerCache");
    expect(loader).toContain("cacheTags.domainOrg");
    expect(loader).toContain("CACHE_TTL.DASHBOARD");
  }, 30_000);

  it("generates revalidation in actions", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "tags", withApi: false });

    const actions = await fs.readFile(path.join(tmpDir, "lib/actions/tags.actions.ts"), "utf8");
    expect(actions).toContain("revalidate");
    expect(actions).toContain("revalidate.orgs");
  }, 30_000);

  it("generates UI page with loader and action imports", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "reviews", withApi: false });

    const page = await fs.readFile(path.join(tmpDir, "app/app/reviews/page.tsx"), "utf8");
    expect(page).toContain("loadReviewsList");
    expect(page).toContain("createReviews");
    expect(page).toContain("Input");
    expect(page).toContain("Button");
    expect(page).toContain("Card");
  }, 30_000);

  it("generates API route with auth guard when --with-api", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "analytics", withApi: true });

    const apiRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/analytics/route.ts"), "utf8");
    expect(apiRoute).toContain("guardApiRequest");
    expect(apiRoute).toContain("toApiErrorResponse");
    expect(apiRoute).toContain("analyticsService_list");
    expect(apiRoute).toContain("orgId query parameter required");
  }, 30_000);

  it("generates client hooks with TanStack Query when --with-api", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "notifications", withApi: true });

    const hooks = await fs.readFile(path.join(tmpDir, "lib/hooks/client/use-notifications.client.ts"), "utf8");
    expect(hooks).toContain("useQuery");
    expect(hooks).toContain("useMutation");
    expect(hooks).toContain("useQueryClient");
    expect(hooks).toContain("invalidateQueries");
    expect(hooks).toContain("notificationsKeys");
  }, 30_000);

  it("generates multiple domains without conflicts", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "posts", withApi: false });
    await runGenerateDomain({ projectRoot: tmpDir, domain: "comments", withApi: false });

    // Both should exist
    const postsRepo = await fs.access(path.join(tmpDir, "lib/repos/posts.repo.ts")).then(() => true).catch(() => false);
    expect(postsRepo).toBe(true);

    const commentsRepo = await fs.access(path.join(tmpDir, "lib/repos/comments.repo.ts")).then(() => true).catch(() => false);
    expect(commentsRepo).toBe(true);

    // Schema should have both
    const schema = await fs.readFile(path.join(tmpDir, "lib/db/schema.ts"), "utf8");
    expect(schema).toContain("posts");
    expect(schema).toContain("comments");
  }, 60_000);

  it("generates test stubs for each domain", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "articles", withApi: false });

    const testDir = path.join(tmpDir, "tests", "articles");
    const repoTest = await fs.access(path.join(testDir, "articles.repo.test.ts")).then(() => true).catch(() => false);
    expect(repoTest).toBe(true);

    const rulesTest = await fs.access(path.join(testDir, "articles.rules.test.ts")).then(() => true).catch(() => false);
    expect(rulesTest).toBe(true);

    const actionsTest = await fs.access(path.join(testDir, "articles.actions.test.ts")).then(() => true).catch(() => false);
    expect(actionsTest).toBe(true);
  }, 30_000);

  it("generates API routes that use error envelope", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "reports", withApi: true });

    const apiRoute = await fs.readFile(path.join(tmpDir, "app/api/v1/reports/route.ts"), "utf8");
    expect(apiRoute).toContain("toApiErrorResponse");
    expect(apiRoute).toContain("x-request-id");
  }, 30_000);

  it("generates loader that uses domain-specific cache tags", async () => {
    await runGenerateDomain({ projectRoot: tmpDir, domain: "analytics", withApi: false });

    const loader = await fs.readFile(path.join(tmpDir, "lib/loaders/analytics.loader.ts"), "utf8");
    expect(loader).toContain("cacheTags.domainOrg");
    expect(loader).toContain('"analytics"');
    // Should NOT use billingOrg
    expect(loader).not.toContain("billingOrg");
  }, 30_000);
});
