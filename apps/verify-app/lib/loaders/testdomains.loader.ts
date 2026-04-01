import { cache } from "react";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { testdomainService_list } from "@/lib/services/testdomains.service";

const loadTestdomainListCached = withServerCache(
  async (orgId: string) => await testdomainService_list({ orgId }),
  {
    key: (orgId: string) => ["testdomains", "org", orgId],
    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadTestdomainList = cache(async () => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) return [];
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  return await loadTestdomainListCached(orgId);
});
