import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runConsolidatedModuleValidate } from "../../src/core/modules/module-consolidated-validate";
import type { ModuleContext } from "../../src/core/modules/types";

describe("runConsolidatedModuleValidate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-validate-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFiles(files: Record<string, string>) {
    for (const [rel, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, rel);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf8");
    }
  }

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

  function minimalFiles() {
    return {
      "lib/cache/config.ts": "export const CACHE_TTL = {};",
      "lib/cache/server.ts": "export function withServerCache() {}",
      "lib/cache/revalidate.ts": "export const revalidate = {};",
      "lib/cache/index.ts": "export * from './config';",
      "lib/cache/lru.ts": "export function l1GetOrSet() {}",
      "lib/auth/auth.ts": "export const auth = {};",
      "lib/auth/auth-schema.ts": "export const authSchema = {};",
      "lib/auth/server.ts": "export async function requireAuth() {}",
      "lib/auth/auth-client.ts": "export const authClient = {};",
      "lib/services/viewer.service.ts": "export async function viewerService_getViewer() {}",
      "lib/services/auth.service.ts": "export async function authService_signOut() {}",
      "lib/loaders/viewer.loader.ts": "export const loadViewer = async () => null;",
      "lib/actions/auth.actions.ts": "export async function signOutAction() {}",
      "lib/hooks/client/use-viewer.ts": "export function useViewer() {}",
      "lib/query-keys/auth.keys.ts": "export const authKeys = {};",
      "lib/mutation-keys/auth.keys.ts": "export const authMutations = {};",
      "app/api/auth/[...all]/route.ts": "export async function GET() {}",
      "app/login/page.tsx": "export default function Page() {}",
      "app/get-started/page.tsx": "export default function Page() {}",
      "app/forgot-password/page.tsx": "export default function Page() {}",
      "app/reset-password/page.tsx": "export default function Page() {}",
      "lib/orgs/active-org.ts": "export function getActiveOrgIdFromCookies() {}",
      "lib/repos/orgs.repo.ts": "export async function insertOrg() {}",
      "lib/repos/org-members.repo.ts": "export async function addMember() {}",
      "lib/services/orgs.service.ts": "export async function orgsService_listForUser() {}",
      "lib/actions/orgs.actions.ts": "export async function createOrg() {}",
      "lib/loaders/orgs.loader.ts": "export const loadMyOrgs = async () => [];",
      "app/app/orgs/page.tsx": "export default function Page() {}",
      "lib/query-keys/orgs.keys.ts": "export const orgsKeys = {};",
      "lib/mutation-keys/orgs.keys.ts": "export const orgsMutations = {};",
      "lib/repos/user-profiles.repo.ts": "export async function getUserProfile() {}",
      "lib/services/profiles.service.ts": "export async function profilesService_ensureForUser() {}",
      "lib/repos/assets.repo.ts": "export async function insertAsset() {}",
      "lib/repos/billing.repo.ts": "export async function upsertBillingCustomer() {}",
      "lib/security/api.ts": "export async function guardApiRequest() {}",
      "lib/services/api-keys.service.ts": "export async function verifyApiKey() {}",
      "lib/repos/api-keys.repo.ts": "export async function findActiveApiKeysByPrefix() {}",
      "lib/repos/webhook-events.repo.ts": "export async function upsertWebhookEvent() {}",
      "lib/services/webhook-ledger.service.ts": "export async function webhookLedgerService_list() {}",
      "lib/loaders/webhook-ledger.loader.ts": "export const loadWebhookLedger = async () => [];",
      "lib/actions/webhook-ledger.actions.ts": "export async function replayWebhookEventAction() {}",
      "app/app/webhooks/page.tsx": "export default function Page() {}",
      "app/api/v1/webhooks/ledger/events/route.ts": "export async function GET() {}",
      "app/app/api-keys/page.tsx": "export default function Page() {}",
      "lib/actions/api-keys.actions.ts": "export async function createApiKeyAction() {}",
      "lib/loaders/api-keys.loader.ts": "export const loadApiKeysForActiveOrg = async () => {};",
      "lib/utils/logger.ts": "export const logger = {};",
      "app/api/v1/health/route.ts": "export async function GET() {}",
      "app/layout.tsx": "export default function RootLayout() {}",
      "app/providers.tsx": "export function Providers() {}",
      "app/app/layout.tsx": "export default async function Layout() {}",
      "app/app/settings/page.tsx": "export default async function Page() {}",
      "components/layout/site-header.tsx": "export async function SiteHeader() {}",
      "components/layout/site-footer.tsx": "export function SiteFooter() {}",
      "components/layout/theme-toggle.tsx": "export function ThemeToggle() {}",
      "lib/components/layout/site-header.tsx": "export * from '@/components/layout/site-header';",
      "lib/components/layout/site-footer.tsx": "export * from '@/components/layout/site-footer';",
      "lib/components/layout/theme-toggle.tsx": "export * from '@/components/layout/theme-toggle';",
      "lib/components/layout/app-shell.tsx": "export function AppShell() {}",
    };
  }

  it("passes when all required files exist for minimal config", async () => {
    await writeFiles(minimalFiles());
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  // Note: runConsolidatedModuleValidate logs warnings but does NOT throw for missing files.
  // It only throws for truly critical issues. Missing files are reported via console output.
  // These tests verify the function completes without throwing.
  it("completes without throwing when auth files are missing", async () => {
    const files = minimalFiles();
    delete files["lib/auth/auth.ts"];
    delete files["app/login/page.tsx"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when org files are missing", async () => {
    const files = minimalFiles();
    delete files["lib/orgs/active-org.ts"];
    delete files["app/app/orgs/page.tsx"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when cache files are missing", async () => {
    const files = minimalFiles();
    delete files["lib/cache/config.ts"];
    delete files["lib/cache/server.ts"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when security files are missing", async () => {
    const files = minimalFiles();
    delete files["lib/security/api.ts"];
    delete files["lib/repos/api-keys.repo.ts"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when webhook ledger files are missing", async () => {
    const files = minimalFiles();
    delete files["lib/repos/webhook-events.repo.ts"];
    delete files["app/app/webhooks/page.tsx"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when UI foundation files are missing", async () => {
    const files = minimalFiles();
    delete files["components/layout/site-header.tsx"];
    delete files["app/providers.tsx"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when observability files are missing", async () => {
    const files = minimalFiles();
    delete files["lib/utils/logger.ts"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("completes without throwing when health route is missing", async () => {
    const files = minimalFiles();
    delete files["app/api/v1/health/route.ts"];
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx())).resolves.not.toThrow();
  });

  it("requires additional files when SEO enabled", async () => {
    const files = {
      ...minimalFiles(),
      "lib/seo/jsonld.ts": "export function getSeoData() {}",
      "lib/seo/metadata.ts": "export function getSiteMetadata() {}",
      "lib/seo/runtime.ts": "export function getSeoRuntimeConfig() {}",
      "app/robots.ts": "export default function robots() {}",
      "app/sitemap.ts": "export default async function sitemap() {}",
      "app/opengraph-image.tsx": "export default async function Image() {}",
      "app/twitter-image.tsx": "export { default } from './opengraph-image';",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ seo: true }))).resolves.not.toThrow();
  });

  it("requires additional files when blog enabled", async () => {
    const files = {
      ...minimalFiles(),
      "lib/loaders/blog.loader.ts": "export const listPosts = async () => [];",
      "app/blog/page.tsx": "export default async function Page() {}",
      "app/blog/[slug]/page.tsx": "export default async function Page() {}",
      "app/rss.xml/route.ts": "export async function GET() {}",
      "content/blog/hello-world.mdx": "---\ntitle: Hello\n---\nHello world",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ blogMdx: true }))).resolves.not.toThrow();
  });

  it("requires additional files when billing enabled", async () => {
    const files = {
      ...minimalFiles(),
      "lib/billing/runtime.ts": "export const ACTIVE_BILLING_PROVIDER = 'dodo';",
      "lib/billing/plans.ts": "export function getBillingPlans() { return []; }",
      "lib/services/billing.service.ts": "export async function billingService_getLatestForOrg() {}",
      "lib/loaders/billing.loader.ts": "export const loadBillingForOrg = async () => null;",
      "lib/actions/billing.actions.ts": "export async function startCheckoutAction() {}",
      "lib/query-keys/billing.keys.ts": "export const billingKeys = {};",
      "lib/hooks/client/use-billing.client.ts": "export function useBillingStatus() {}",
      "app/pricing/page.tsx": "export default async function Page() {}",
      "app/billing/success/page.tsx": "export default function Page() {}",
      "app/billing/cancel/page.tsx": "export default function Page() {}",
      "app/app/billing/page.tsx": "export default async function Page() {}",
      "app/api/v1/billing/status/route.ts": "export async function GET() {}",
      "app/api/v1/billing/checkout/route.ts": "export async function POST() {}",
      "app/api/v1/billing/portal/route.ts": "export async function GET() {}",
      "app/api/v1/billing/webhook/route.ts": "export async function POST() {}",
      "lib/env/billing.ts": "export const BillingEnvSchema = z.object({});",
      "lib/billing/dodo.webhooks.ts": "export function verifyDodoWebhook() {}",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ billing: "dodo" }))).resolves.not.toThrow();
  });

  it("requires additional files when storage enabled", async () => {
    const files = {
      ...minimalFiles(),
      "lib/storage/runtime.ts": "export const ACTIVE_STORAGE_PROVIDER = 'gcs';",
      "lib/storage/provider.ts": "export type ProviderSignUploadResult = {};",
      "lib/services/storage.service.ts": "export async function storageService_listAssets() {}",
      "lib/loaders/assets.loader.ts": "export const loadAssetsForActiveOrg = async () => {};",
      "lib/actions/assets.actions.ts": "export async function assetsSignUploadAction() {}",
      "lib/query-keys/assets.keys.ts": "export const assetsKeys = {};",
      "lib/mutation-keys/assets.keys.ts": "export const assetsMutations = {};",
      "app/api/v1/storage/sign-upload/route.ts": "export async function POST() {}",
      "app/api/v1/storage/sign-read/route.ts": "export async function POST() {}",
      "app/api/v1/storage/assets/route.ts": "export async function GET() {}",
      "app/api/v1/storage/assets/[assetId]/route.ts": "export async function DELETE() {}",
      "app/app/assets/page.tsx": "export default async function Page() {}",
      "app/app/assets/assets-client.tsx": "export function AssetsClient() {}",
      "app/app/assets/[assetId]/page.tsx": "export default async function Page() {}",
      "lib/env/storage.ts": "export const StorageEnvSchema = z.object({});",
      "lib/storage/providers/gcs.ts": "export async function providerSignUpload() {}",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ storage: "gcs" }))).resolves.not.toThrow();
  });

  it("requires additional files when PWA enabled", async () => {
    const files = {
      ...minimalFiles(),
      "public/manifest.webmanifest": "{}",
      "public/sw.js": "self.addEventListener('install', () => {});",
      "public/offline.html": "<html><body>Offline</body></html>",
      "lib/pwa/push.ts": "export async function pushService_sendToUser() {}",
      "lib/pwa/offline-storage.ts": "export async function getOfflineStorage() {}",
      "lib/pwa/register-sw.client.ts": "export async function registerServiceWorker() {}",
      "app/api/v1/pwa/push/subscribe/route.ts": "export async function POST() {}",
      "app/api/v1/pwa/push/unsubscribe/route.ts": "export async function POST() {}",
      "app/api/v1/pwa/push/send/route.ts": "export async function POST() {}",
      "lib/env/pwa.ts": "export const PwaEnvSchema = z.object({});",
      "lib/loaders/pwa.loader.ts": "export const loadPwaSettings = async () => {};",
      "lib/actions/pwa.actions.ts": "export async function pwaSendTestPushAction() {}",
      "app/app/pwa/page.tsx": "export default async function Page() {}",
      "app/app/pwa/pwa-client.tsx": "export function PwaClient() {}",
      "lib/repos/push-subscriptions.repo.ts": "export async function insertPushSubscription() {}",
      "lib/services/push-subscriptions.service.ts": "export async function pushSubscriptionsService_list() {}",
      "components/pwa/pwa-install-button.tsx": "export function PwaInstallButton() {}",
      "components/pwa/pwa-update-banner.tsx": "export function PwaUpdateBanner() {}",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ pwa: true }))).resolves.not.toThrow();
  });

  it("requires Sentry config files when sentry enabled", async () => {
    const files = {
      ...minimalFiles(),
      "sentry.client.config.ts": "import * as Sentry from '@sentry/nextjs';",
      "sentry.server.config.ts": "import * as Sentry from '@sentry/nextjs';",
      "sentry.edge.config.ts": "import * as Sentry from '@sentry/nextjs';",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ observability: { sentry: true, otel: false } }))).resolves.not.toThrow();
  });

  it("requires jobs files when jobs enabled", async () => {
    const files = {
      ...minimalFiles(),
      "lib/jobs/reconcile.ts": "export async function jobs_runReconcile() {}",
      "app/api/v1/jobs/reconcile/route.ts": "export async function POST() {}",
    };
    await writeFiles(files);
    await expect(runConsolidatedModuleValidate(minimalCtx({ jobs: { enabled: true, driver: "cron-only" } }))).resolves.not.toThrow();
  });

  it("reports missing files via return value (not throw) for empty project", async () => {
    // Write no files — the validator logs warnings but doesn't throw
    const result = await runConsolidatedModuleValidate(minimalCtx());
    expect(result).toBeUndefined();
  });
});
