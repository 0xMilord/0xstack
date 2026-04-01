"use server";

import { cookies } from "next/headers";
import { createTestdomainInput, deleteTestdomainInput, updateTestdomainInput } from "@/lib/rules/testdomains.rules";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { revalidate } from "@/lib/cache";
import { testdomainService_create, testdomainService_delete, testdomainService_list, testdomainService_update } from "@/lib/services/testdomains.service";

export async function listTestdomainForViewer() {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  return await testdomainService_list({ orgId });
}

export async function createTestdomain(input: unknown) {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  const data = createTestdomainInput.parse(input);
  const created = await testdomainService_create({
    name: data.name,
    orgId,
    createdByUserId: session.userId,
  });
  revalidate.orgs(session.userId);
  return { ok: true, data: created };
}

export async function updateTestdomain(input: unknown) {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  const data = updateTestdomainInput.parse(input);
  const updated = await testdomainService_update({ id: data.id, orgId, patch: { name: data.name } });
  revalidate.orgs(session.userId);
  return { ok: true, data: updated };
}

export async function deleteTestdomain(input: unknown) {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  const data = deleteTestdomainInput.parse(input);
  const deleted = await testdomainService_delete({ id: data.id, orgId });
  revalidate.orgs(session.userId);
  return { ok: true, data: deleted };
}
