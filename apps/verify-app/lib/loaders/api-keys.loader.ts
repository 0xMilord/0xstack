import { cache } from "react";
import { cookies } from "next/headers";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { apiKeysService_listForOrg } from "@/lib/services/api-keys.service";

const loadApiKeysOrgCached = withServerCache(
  async (orgId: string) => await apiKeysService_listForOrg(orgId),
  {
    key: (orgId: string) => ["api-keys", "org", orgId],
    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadApiKeysForActiveOrg = cache(async () => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) return { orgId: null, keys: [] as any[] };
  // membership is enforced by the workspace layout guard; this is read-model only.
  return { orgId, keys: await loadApiKeysOrgCached(orgId), viewer };
});
