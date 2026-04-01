import { cache } from "react";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { storageService_getAssetForViewer, storageService_listAssets } from "@/lib/services/storage.service";

const loadAssetsOrgCached = withServerCache(
  async (orgId: string) => await storageService_listAssets({ orgId }),
  {
    key: (orgId: string) => ["assets", "org", orgId],
    tags: (orgId: string) => [cacheTags.assetsOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadAssetsForActiveOrg = cache(async () => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) return { viewer, orgId: null as string | null, assets: [] as any[] };
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  return { viewer, orgId, assets: await loadAssetsOrgCached(orgId) };
});

export const loadAssetForViewer = cache(async (assetId: string) => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const asset = await storageService_getAssetForViewer({ assetId, userId: viewer.userId, activeOrgId: orgId });
  return { viewer, orgId, asset };
});
