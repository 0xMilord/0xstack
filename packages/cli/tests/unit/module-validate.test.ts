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

  it("passes when all required files exist for minimal config", async () => {
    const ctx: ModuleContext = {
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
      },
    };
    // Write minimal required files
    await writeFiles({
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
    });

    await expect(runConsolidatedModuleValidate(ctx)).resolves.not.toThrow();
  });

  it("throws when required files are missing", async () => {
    const ctx: ModuleContext = {
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
      },
    };
    // Write no files
    await expect(runConsolidatedModuleValidate(ctx)).rejects.toThrow();
  });
});
