import crypto from "node:crypto";
import { insertOrg } from "@/lib/repos/orgs.repo";
import { addMember, listOrgsForUser } from "@/lib/repos/org-members.repo";

export async function orgsService_listForUser(userId: string) {
  return await listOrgsForUser(userId);
}

export async function orgsService_createForUser(input: { userId: string; name: string }) {
  const orgId = crypto.randomUUID();
  const org = await insertOrg({ id: orgId, name: input.name });
  await addMember({ orgId, userId: input.userId, role: "owner" });
  return org;
}
