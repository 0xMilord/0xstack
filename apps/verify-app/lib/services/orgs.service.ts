import crypto from "node:crypto";
import { insertOrg } from "@/lib/repos/orgs.repo";
import { addMember, getMembership, isMember, listOrgsForUser } from "@/lib/repos/org-members.repo";

export const ORG_ROLES = ["member", "admin", "owner"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

function roleRank(role: string | null | undefined) {
  if (role === "owner") return 3;
  if (role === "admin") return 2;
  if (role === "member") return 1;
  return 0;
}

export async function orgsService_listForUser(userId: string) {
  return await listOrgsForUser(userId);
}

export async function orgsService_createForUser(input: { userId: string; name: string }) {
  const orgId = crypto.randomUUID();
  const org = await insertOrg({ id: orgId, name: input.name });
  await addMember({ orgId, userId: input.userId, role: "owner" });
  return org;
}

export async function orgsService_assertMember(input: { userId: string; orgId: string }) {
  const ok = await isMember(input.orgId, input.userId);
  if (!ok) throw new Error("not_org_member");
}

export async function orgsService_assertRoleAtLeast(input: { userId: string; orgId: string; atLeast: OrgRole }) {
  const m = await getMembership({ orgId: input.orgId, userId: input.userId });
  if (!m) throw new Error("not_org_member");
  if (roleRank((m as any).role) < roleRank(input.atLeast)) throw new Error("insufficient_role");
  return m;
}

export async function orgsService_resolveActiveOrg(input: { userId: string; cookieOrgId: string | null }) {
  const rows = await listOrgsForUser(input.userId);
  if (!rows.length) return { ok: false as const, reason: "no_orgs" as const };
  const id = input.cookieOrgId;
  if (!id) return { ok: false as const, reason: "no_cookie" as const };
  const member = rows.some((r) => r.org.id === id);
  if (!member) return { ok: false as const, reason: "not_member" as const };
  return { ok: true as const, orgId: id };
}
