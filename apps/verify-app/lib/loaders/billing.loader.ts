import { cache } from "react";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { billingService_getLatestForOrg } from "@/lib/services/billing.service";

const loadBillingOrgCached = withServerCache(
  async (orgId: string) => await billingService_getLatestForOrg(orgId),
  {
    key: (orgId: string) => ["billing", "org", orgId],
    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadBillingForOrg = cache(async (orgId: string) => await loadBillingOrgCached(orgId));
