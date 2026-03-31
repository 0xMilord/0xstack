"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { createOrgInput } from "@/lib/rules/orgs.rules";
import { orgsService_createForUser } from "@/lib/services/orgs.service";

export async function createOrg(input: unknown) {
  const viewer = await requireAuth();
  const data = createOrgInput.parse(input);
  const org = await orgsService_createForUser({ userId: viewer.userId, name: data.name });
  cookies().set("ox_org", String(org?.id ?? ""), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/app/orgs");
  return { ok: true, org };
}

export async function setActiveOrg(input: { orgId: string }) {
  const viewer = await requireAuth();
  // basic guard: cookie is only set after auth; membership check happens in services when used.
  cookies().set("ox_org", String(input.orgId), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/app");
  return { ok: true, userId: viewer.userId };
}
