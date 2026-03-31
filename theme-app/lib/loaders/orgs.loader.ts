import { cache } from "react";
import { headers } from "next/headers";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { viewerService_getViewer } from "@/lib/services/viewer.service";
import { orgsService_listForUser } from "@/lib/services/orgs.service";

const loadMyOrgsCached = withServerCache(
  async () => {
    const h = await headers();
    const viewer = await viewerService_getViewer(h as any);
    if (!viewer?.userId) return [];
    return await orgsService_listForUser(viewer.userId);
  },
  {
    key: () => ["orgs", "mine"],
    tags: () => [cacheTags.dashboard],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadMyOrgs = cache(loadMyOrgsCached);
