import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureApiKeysTable, ensureAssetsTable, ensureBillingTables, ensureOrgInvitesTable, ensureOrgsTables } from "../generate/schema-edit";

export const coreDbStateModule: Module = {
  id: "core-db-state",
  install: async () => { },
  activate: async (ctx) => {
    await ensureOrgsTables(ctx.projectRoot);
    await ensureOrgInvitesTable(ctx.projectRoot);
    await ensureApiKeysTable(ctx.projectRoot);
    await ensureAssetsTable(ctx.projectRoot);
    await ensureBillingTables(ctx.projectRoot);

    await backupAndRemove(ctx.projectRoot, "app/app/page.tsx");
    await backupAndRemove(ctx.projectRoot, "app/app/settings/page.tsx");

    await ensureDir(path.join(ctx.projectRoot, "lib", "orgs"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "orgs", "active-org.ts"),
      `/**
 * Active org backbone — cookie-based org selection for multi-tenant apps.
 * 
 * Usage:
 *   - Server Components: use getActiveOrgIdFromCookies(cookies()) + requireActiveOrg()
 *   - Server Actions: use setActiveOrgCookie(response, orgId) after selection
 *   - API Routes: use getActiveOrgIdFromCookies(new RequestCookies(request.headers))
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { orgsService_resolveActiveOrg } from "@/lib/services/orgs.service";
import { requireAuth } from "@/lib/auth/server";

/** HttpOnly cookie name set when the user selects an org. */
export const ACTIVE_ORG_COOKIE = "ox_org";

/**
 * Extract active org ID from cookie store (Next.js cookies() or RequestCookies).
 * Returns null if not present or empty.
 */
export function getActiveOrgIdFromCookies(cookieStore: { get: (name: string) => { value: string } | undefined }): string | null {
  const v = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim();
  return v && v.length > 0 ? v : null;
}

/**
 * Set active org cookie on response. Use in server actions after org selection.
 */
export function setActiveOrgCookie(response: Response, orgId: string) {
  response.headers.set("Set-Cookie", \`\${ACTIVE_ORG_COOKIE}=\${orgId}; HttpOnly; Secure; SameSite=Lax; Path=/\`);
}

/**
 * Require an active org for the current user. Throws redirect to /app/orgs if no org is active.
 * Use this in server components that require org context.
 */
export async function requireActiveOrg() {
  const viewer = await requireAuth();
  const cookieStore = await cookies();
  const cookieOrgId = getActiveOrgIdFromCookies(cookieStore);
  const gate = await orgsService_resolveActiveOrg({ userId: viewer.userId, cookieOrgId: cookieOrgId });
  if (!gate.ok || !gate.org) {
    redirect("/app/orgs");
  }
  return { viewer, org: gate.org };
}

/**
 * Get active org ID for the current user (no redirect). Returns null if no org is active.
 */
export async function getActiveOrgId(): Promise<string | null> {
  try {
    const viewer = await requireAuth();
    const cookieStore = await cookies();
    const cookieOrgId = getActiveOrgIdFromCookies(cookieStore);
    const gate = await orgsService_resolveActiveOrg({ userId: viewer.userId, cookieOrgId: cookieOrgId });
    return gate.org?.id ?? null;
  } catch {
    return null;
  }
}
`
    );

    // Server Component page that gates on having an active org cookie.
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "page.tsx"),
      `import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_resolveActiveOrg } from "@/lib/services/orgs.service";

export default async function Page() {
  const viewer = await requireAuth();
  const cookieOrg = getActiveOrgIdFromCookies(await cookies());
  const gate = await orgsService_resolveActiveOrg({ userId: viewer.userId, cookieOrgId: cookieOrg });
  if (!gate.ok) redirect("/app/orgs");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Workspace</h1>
        <p className="text-sm text-muted-foreground">You have an active organization. Open settings, billing, or assets from here.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/settings">
              Settings
            </Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/orgs">
              Switch organization
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
`
    );

    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "rules"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "orgs"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "assets.repo.ts"),
      `import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

export async function insertAsset(input: typeof assets.$inferInsert) {
  const rows = await db.insert(assets).values(input).returning();
  return rows[0] ?? null;
}

export async function listAssetsForUser(userId: string, options?: { limit?: number; cursor?: string }) {
  const limit = Math.min(options?.limit ?? 50, 200);
  const cursor = options?.cursor;
  const conditions = [eq(assets.ownerUserId, userId), isNull(assets.orgId)];
  if (cursor) conditions.push(gt(assets.id, cursor));
  return await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(assets.id)
    .limit(limit);
}

export async function listAssetsForOrg(orgId: string, options?: { limit?: number; cursor?: string }) {
  const limit = Math.min(options?.limit ?? 50, 200);
  const cursor = options?.cursor;
  const conditions = [eq(assets.orgId, orgId)];
  if (cursor) conditions.push(gt(assets.id, cursor));
  return await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(assets.id)
    .limit(limit);
}

export async function getAssetById(assetId: string) {
  const rows = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteAssetById(assetId: string) {
  const rows = await db.delete(assets).where(eq(assets.id, assetId)).returning();
  return rows[0] ?? null;
}

/**
 * Return all objectKey values from the assets table.
 * Used by the orphan-cleanup mechanism to compare against GCS bucket contents.
 */
export async function listAllAssetObjectKeys(): Promise<string[]> {
  const rows = await db.select({ objectKey: assets.objectKey }).from(assets);
  return rows.map((r) => r.objectKey);
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "billing.repo.ts"),
      `import { db } from "@/lib/db";
import { billingCustomers, billingSubscriptions } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function upsertBillingCustomer(input: {
  userId: string;
  dodoCustomerId?: string | null;
  stripeCustomerId?: string | null;
}) {
  await db.execute(sql\`
    insert into billing_customers (user_id, dodo_customer_id, stripe_customer_id)
    values (\${input.userId}, \${input.dodoCustomerId ?? null}, \${input.stripeCustomerId ?? null})
    on conflict (user_id) do update set
      dodo_customer_id = coalesce(excluded.dodo_customer_id, billing_customers.dodo_customer_id),
      stripe_customer_id = coalesce(excluded.stripe_customer_id, billing_customers.stripe_customer_id)
  \`);
}

export async function getStripeCustomerIdForUser(userId: string) {
  const rows = await db
    .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);
  const id = rows[0]?.stripeCustomerId;
  return id && id.length ? id : null;
}

export async function upsertBillingSubscription(input: {
  provider: string;
  providerSubscriptionId: string;
  status: string;
  planId?: string | null;
  orgId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
}) {
  await db.execute(sql\`
    insert into billing_subscriptions (provider, provider_subscription_id, status, plan_id, org_id, current_period_end, cancel_at_period_end, updated_at)
    values (\${input.provider}, \${input.providerSubscriptionId}, \${input.status}, \${input.planId ?? null}, \${input.orgId ?? null}, \${input.currentPeriodEnd ?? null}, \${input.cancelAtPeriodEnd ?? null}, now())
      on conflict (provider_subscription_id) do update set
      status = excluded.status,
      plan_id = excluded.plan_id,
      org_id = excluded.org_id,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = now()
  \`);
}

export async function getLatestBillingSubscriptionForOrg(orgId: string) {
  const rows = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.orgId, orgId))
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBillingCustomerByDodoId(dodoCustomerId: string) {
  const rows = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.dodoCustomerId, dodoCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getStripeCustomerIdForOrg(orgId: string) {
  const rows = await db
    .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
    .from(billingSubscriptions)
    .leftJoin(billingCustomers, eq(billingSubscriptions.orgId, billingCustomers.userId))
    .where(eq(billingSubscriptions.orgId, orgId))
    .limit(1);
  const id = rows[0]?.stripeCustomerId;
  return id && id.length ? id : null;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "orgs.repo.ts"),
      `import { db } from "@/lib/db";
import { orgs, orgInvites } from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

export async function insertOrg(input: typeof orgs.$inferInsert) {
  const rows = await db.insert(orgs).values(input).returning();
  return rows[0] ?? null;
}

export async function getOrgById(id: string) {
  const rows = await db.select().from(orgs).where(eq(orgs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createInvite(input: typeof orgInvites.$inferInsert) {
  const rows = await db.insert(orgInvites).values(input).returning();
  return rows[0] ?? null;
}

export async function findInviteByToken(token: string) {
  const rows = await db
    .select()
    .from(orgInvites)
    .where(and(eq(orgInvites.token, token), isNull(orgInvites.usedAt), gt(orgInvites.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function acceptInvite(token: string, userId: string) {
  const now = new Date();
  const rows = await db
    .update(orgInvites)
    .set({ usedAt: now })
    .where(and(eq(orgInvites.token, token), isNull(orgInvites.usedAt)))
    .returning();
  return rows[0] ?? null;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "user-profiles.repo.ts"),
      `import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserProfile(userId: string) {
  const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function ensureUserProfile(userId: string) {
  const existing = await getUserProfile(userId);
  if (existing) return existing;
  const rows = await db.insert(userProfiles).values({ userId }).returning();
  return rows[0] ?? null;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "profiles.service.ts"),
      `import { ensureUserProfile } from "@/lib/repos/user-profiles.repo";

export async function profilesService_ensureForUser(userId: string) {
  return await ensureUserProfile(userId);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "org-members.repo.ts"),
      `import { db } from "@/lib/db";
import { orgMembers, orgs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function addMember(input: typeof orgMembers.$inferInsert) {
  const rows = await db.insert(orgMembers).values(input).returning();
  return rows[0] ?? null;
}

export async function removeMember(input: { orgId: string; userId: string }) {
  const rows = await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId)))
    .returning();
  return rows[0] ?? null;
}

export async function listOrgsForUser(userId: string) {
  const rows = await db
    .select({ org: orgs, membership: orgMembers })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId))
    .limit(200);
  return rows;
}

export async function listMembersForOrg(orgId: string) {
  const rows = await db
    .select({ member: orgMembers })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, orgId))
    .limit(200);
  return rows;
}

export async function getMembership(input: { orgId: string; userId: string }) {
  const rows = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, input.userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function isMember(orgId: string, userId: string) {
  return !!(await getMembership({ orgId, userId }));
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "orgs.service.ts"),
      `import crypto from "node:crypto";
import { insertOrg, createInvite, findInviteByToken, acceptInvite as repoAcceptInvite } from "@/lib/repos/orgs.repo";
import { addMember, getMembership, isMember, listMembersForOrg, listOrgsForUser, removeMember } from "@/lib/repos/org-members.repo";
import { getOrgById } from "@/lib/repos/orgs.repo";

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
  const match = rows.find((r) => r.org.id === id);
  if (!match) return { ok: false as const, reason: "not_member" as const };
  return { ok: true as const, orgId: id, org: match.org, membership: match.membership };
}

export async function orgsService_listMembersForOrg(orgId: string) {
  return await listMembersForOrg(orgId);
}

export async function orgsService_removeMember(input: { orgId: string; userId: string; removedBy: string }) {
  // The remover must be an owner
  const m = await getMembership({ orgId: input.orgId, userId: input.removedBy });
  if (!m || (m as any).role !== "owner") throw new Error("insufficient_role");
  // Cannot remove yourself
  if (input.removedBy === input.userId) throw new Error("cannot_remove_self");
  return await removeMember({ orgId: input.orgId, userId: input.userId });
}

export async function orgsService_createInvites(input: {
  orgId: string;
  members: Array<{ email: string; role: string }>;
  invitedByUserId: string;
}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const results = [];
  for (const member of input.members) {
    const token = crypto.randomBytes(16).toString("hex"); // 32-char hex
    const invite = await createInvite({
      orgId: input.orgId,
      email: member.email.toLowerCase(),
      role: member.role || "member",
      token,
      invitedBy: input.invitedByUserId,
      expiresAt,
    });
    if (invite) results.push({ email: invite.email, token: invite.token, role: invite.role });
  }
  return results;
}

export async function orgsService_acceptInvite(input: { token: string; userId: string; userEmail: string }) {
  const invite = await findInviteByToken(input.token);
  if (!invite) throw new Error("invite_not_found");

  // Check that the current user's email matches the invite email
  if (invite.email.toLowerCase() !== input.userEmail.toLowerCase()) {
    throw new Error("email_mismatch");
  }

  const org = await getOrgById(invite.orgId);
  if (!org) throw new Error("org_not_found");

  // Check if already a member
  const existing = await getMembership({ orgId: invite.orgId, userId: input.userId });
  if (existing) throw new Error("already_member");

  // Mark invite as used
  await repoAcceptInvite(input.token, input.userId);

  // Add user to org members
  await addMember({ orgId: invite.orgId, userId: input.userId, role: invite.role });

  return { ok: true, orgId: invite.orgId, orgName: org.name };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "orgs.keys.ts"),
      `export const orgsKeys = {
  all: ["orgs"] as const,
  mine: () => [...orgsKeys.all, "mine"] as const,
  active: () => [...orgsKeys.all, "active"] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "mutation-keys", "orgs.keys.ts"),
      `export const orgsMutations = {
  create: ["orgs", "create"] as const,
  setActive: ["orgs", "setActive"] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "orgs.loader.ts"),
      `import { cache } from "react";
import { headers } from "next/headers";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { viewerService_getViewer } from "@/lib/services/viewer.service";
import { orgsService_listForUser } from "@/lib/services/orgs.service";

const loadMyOrgsCached = withServerCache(
  async (userId: string) => await orgsService_listForUser(userId),
  {
    key: (userId: string) => ["orgs", "mine", userId],
    tags: (userId: string) => [cacheTags.orgsForUser(userId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadMyOrgs = cache(async () => {
  const h = await headers();
  const viewer = await viewerService_getViewer(h as any);
  if (!viewer?.userId) return [];
  return await loadMyOrgsCached(viewer.userId);
});
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "rules", "orgs.rules.ts"),
      `import { z } from "zod";

export const createOrgInput = z.object({
  name: z.string().min(2).max(80),
});
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "orgs.actions.ts"),
      `"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/orgs/active-org";
import { requireAuth } from "@/lib/auth/server";
import { revalidate } from "@/lib/cache";
import { createOrgInput } from "@/lib/rules/orgs.rules";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember, orgsService_assertRoleAtLeast, orgsService_createForUser, orgsService_removeMember, orgsService_createInvites, orgsService_acceptInvite } from "@/lib/services/orgs.service";

export async function createOrg(input: unknown) {
  const viewer = await requireAuth();
  const data = createOrgInput.parse(input);
  const org = await orgsService_createForUser({ userId: viewer.userId, name: data.name });
  const c = await cookies();
  c.set(ACTIVE_ORG_COOKIE, String(org?.id ?? ""), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  revalidate.orgs(viewer.userId);
  revalidatePath("/app/orgs");
  revalidatePath("/app");
  return { ok: true, org };
}

export async function setActiveOrg(input: { orgId: string }) {
  const viewer = await requireAuth();
  await orgsService_assertMember({ userId: viewer.userId, orgId: input.orgId });
  const c = await cookies();
  c.set(ACTIVE_ORG_COOKIE, String(input.orgId), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  revalidate.orgs(viewer.userId);
  revalidate.billingForOrg(input.orgId);
  revalidate.assetsForOrg(input.orgId);
  revalidatePath("/app");
  return { ok: true, userId: viewer.userId };
}

export async function removeMemberAction(input: { orgId: string; userId: string }) {
  const viewer = await requireAuth();
  await orgsService_removeMember({ orgId: input.orgId, userId: input.userId, removedBy: viewer.userId });
  revalidate.orgs(viewer.userId);
  revalidatePath("/app/orgs");
  return { ok: true as const };
}

export async function inviteMembers(input: { orgId: string; members: Array<{ email: string; role: string }> }) {
  const viewer = await requireAuth();
  await orgsService_assertRoleAtLeast({ userId: viewer.userId, orgId: input.orgId, atLeast: "owner" });
  const invites = await orgsService_createInvites({
    orgId: input.orgId,
    members: input.members,
    invitedByUserId: viewer.userId,
  });

  // Fetch org name for email
  const { getOrgById } = await import("@/lib/repos/orgs.repo");
  const org = await getOrgById(input.orgId);
  const orgName = org?.name ?? input.orgId;

  // Try to send emails, gracefully skip if email module not available
  try {
    const { sendInviteEmail } = await import("@/lib/email/auth-emails");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    for (const inv of invites) {
      await sendInviteEmail({
        to: inv.email,
        userName: inv.email,
        orgName,
        inviteUrl: \`\${appUrl}/invite/\${inv.token}\`,
      });
    }
  } catch {
    // Email module not available — skip sending
  }

  revalidate.orgs(viewer.userId);
  revalidatePath("/app/orgs");
  return { invites };
}

export async function acceptInviteAction(input: { token: string }) {
  const viewer = await requireAuth();
  const result = await orgsService_acceptInvite({ token: input.token, userId: viewer.userId, userEmail: viewer.email });
  revalidate.orgs(viewer.userId);
  revalidatePath("/app");
  return result;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "orgs", "page.tsx"),
      `import { loadMyOrgs } from "@/lib/loaders/orgs.loader";
import { createOrg } from "@/lib/actions/orgs.actions";
import { setActiveOrg, removeMemberAction } from "@/lib/actions/orgs.actions";
import { getActiveOrgId } from "@/lib/orgs/active-org";
import { orgsService_listMembersForOrg } from "@/lib/services/orgs.service";
import { requireAuth } from "@/lib/auth/server";
import { getMembership } from "@/lib/repos/org-members.repo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const rows = await loadMyOrgs();
  const activeOrgId = await getActiveOrgId();

  const activeMembers = activeOrgId
    ? await orgsService_listMembersForOrg(activeOrgId).catch(() => [])
    : [];

  const viewer = await requireAuth();
  const viewerMembership = activeOrgId && viewer.userId
    ? await getMembership({ orgId: activeOrgId, userId: viewer.userId }).catch(() => null)
    : null;
  const isOwner = viewerMembership?.role === "owner";

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Organizations</h1>
      <p className="mt-2 text-sm text-muted-foreground">Create an org, select it, then continue into the app.</p>

      <form
        className="mt-6 flex gap-2"
        action={async (fd) => {
          "use server";
          await createOrg({ name: String(fd.get("name") ?? "") });
        }}
      >
        <Input name="name" placeholder="Acme Inc" required minLength={2} />
        <Button type="submit">Create</Button>
      </form>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((r: any) => (
          <Card key={r.org.id}>
            <CardHeader>
              <CardTitle className="text-base">{r.org.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Role: {r.membership.role}</p>
              <form
                action={async () => {
                  "use server";
                  await setActiveOrg({ orgId: r.org.id });
                }}
              >
                <Button type="submit" variant="secondary">
                  Use org
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeOrgId && activeMembers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Members of active org</h2>
          <div className="space-y-3">
            {activeMembers.map((m: any) => (
              <div
                key={m.member.userId}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="font-mono text-sm">{m.member.userId}</p>
                  <p className="text-xs text-muted-foreground">Role: {m.member.role}</p>
                </div>
                {isOwner && m.member.role !== "owner" && (
                  <form
                    action={async () => {
                      "use server";
                      await removeMemberAction({ orgId: activeOrgId, userId: m.member.userId });
                    }}
                  >
                    <Button type="submit" variant="destructive" size="sm">
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
`
    );

    // Invite accept page
    await ensureDir(path.join(ctx.projectRoot, "app", "invite", "[token]"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "invite", "[token]", "page.tsx"),
      `"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "@/lib/actions/orgs.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "joined" | "error" | "already_member">("idle");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setStatus("loading");
    setError(null);
    try {
      const result = await acceptInviteAction({ token });
      if (result.ok) {
        setOrgName((result as any).orgName ?? null);
        setStatus("joined");
        setTimeout(() => router.push("/app"), 1500);
      }
    } catch (err: any) {
      // requireAuth() triggers a redirect to /login via Next.js redirect()
      if (err?.digest?.includes("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
        router.push("/login");
        return;
      }
      const msg = err?.message ?? "Something went wrong";
      if (msg === "invite_not_found" || msg === "org_not_found") {
        setError("This invite link is invalid or has expired.");
      } else if (msg === "already_member") {
        setStatus("already_member");
      } else if (msg === "email_mismatch") {
        setError("This invite was sent to a different email address. Please log in with the correct account.");
      } else {
        setError(msg);
      }
      setStatus("error");
    }
  }

  function handleDecline() {
    router.push("/login");
  }

  if (status === "joined") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Welcome to {orgName ?? "the organization"}!</CardTitle>
            <CardDescription>You have been added as a member.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Redirecting to the app...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status === "already_member") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">You&apos;re already a member</CardTitle>
            <CardDescription>You are already part of this organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/app")}>Go to App</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Invite unavailable</CardTitle>
            <CardDescription>{error ?? "This invite link is invalid or has expired."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} variant="secondary">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Join the organization?</CardTitle>
          <CardDescription>You have been invited to join an organization. Accept the invitation to become a member.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={handleAccept} disabled={status === "loading"} className="flex-1">
            {status === "loading" ? "Accepting..." : "Accept"}
          </Button>
          <Button onClick={handleDecline} variant="outline" className="flex-1">
            Decline
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
`
    );

    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "health"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "health", "route.ts"),
      `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    t: new Date().toISOString(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasBetterAuthSecret: Boolean(process.env.BETTER_AUTH_SECRET),
    hasPublicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  });
}
`
    );
  },
  validate: async () => { },
  sync: async () => { },
};

