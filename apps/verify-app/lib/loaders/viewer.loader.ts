import { cache } from "react";
import { headers } from "next/headers";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { viewerService_getViewer } from "@/lib/services/viewer.service";

const loadViewerCached = withServerCache(
  async () => {
    const h = await headers();
    return await viewerService_getViewer(h as any);
  },
  {
    key: () => ["auth", "viewer"],
    tags: () => [cacheTags.viewer],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadViewer = cache(loadViewerCached);
