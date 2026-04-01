"use server";

import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { revalidate } from "@/lib/cache";
import { createApiKeyInput, revokeApiKeyInput } from "@/lib/rules/api-keys.rules";
import { apiKeysService_createForOrg, apiKeysService_revokeForOrg } from "@/lib/services/api-keys.service";

export async function createApiKeyAction(input: unknown) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const data = createApiKeyInput.parse(input);
  const created = await apiKeysService_createForOrg({ orgId, name: data.name });
  revalidate.dashboard(viewer.userId);
  return { ok: true as const, created };
}

export async function revokeApiKeyAction(input: unknown) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const data = revokeApiKeyInput.parse(input);
  await apiKeysService_revokeForOrg({ orgId, id: data.id });
  revalidate.dashboard(viewer.userId);
  return { ok: true as const };
}
