import { cache } from "react";
import { headers } from "next/headers";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { viewerService_getViewer } from "@/lib/services/viewer.service";
import { orgsService_listForUser } from "@/lib/services/orgs.service";

const loadMyOrgsCached = withServerCache(
  async (userId: string) => await orgsService_listForUser(userId),
  {
    key: (userId: string) => ["orgs", "mine", userId],
    tags: (userId: string) => [cacheTags.orgsForUser(userId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadMyOrgs = cache(async () => {
  const h = await headers();
  const viewer = await viewerService_getViewer(h as any);
  if (!viewer?.userId) return [];
  return await loadMyOrgsCached(viewer.userId);
});
