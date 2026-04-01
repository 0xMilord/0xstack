"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/orgs/active-org";
import { requireAuth } from "@/lib/auth/server";
import { revalidate } from "@/lib/cache";
import { createOrgInput } from "@/lib/rules/orgs.rules";
import { orgsService_assertMember, orgsService_createForUser } from "@/lib/services/orgs.service";

export async function createOrg(input: unknown) {
  const viewer = await requireAuth();
  const data = createOrgInput.parse(input);
  const org = await orgsService_createForUser({ userId: viewer.userId, name: data.name });
  const c = await cookies();
  c.set(ACTIVE_ORG_COOKIE, String(org?.id ?? ""), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidate.orgs(viewer.userId);
  revalidatePath("/app/orgs");
  revalidatePath("/app");
  return { ok: true, org };
}

export async function setActiveOrg(input: { orgId: string }) {
  const viewer = await requireAuth();
  await orgsService_assertMember({ userId: viewer.userId, orgId: input.orgId });
  const c = await cookies();
  c.set(ACTIVE_ORG_COOKIE, String(input.orgId), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidate.orgs(viewer.userId);
  revalidate.billingForOrg(input.orgId);
  revalidate.assetsForOrg(input.orgId);
  revalidatePath("/app");
  return { ok: true, userId: viewer.userId };
}
