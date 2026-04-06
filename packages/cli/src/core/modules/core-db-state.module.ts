import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureApiKeysTable, ensureAssetsTable, ensureBillingTables, ensureOrgsTables } from "../generate/schema-edit";

export const coreDbStateModule: Module = {
  id: "core-db-state",
  install: async () => { },
  activate: async (ctx) => {
    await ensureOrgsTables(ctx.projectRoot);
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
  response.headers.set("Set-Cookie", \`\${ACTIVE_ORG_COOKIE}=\${orgId}; HttpOnly; SameSite=Lax; Path=/\`);
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
import { and, eq, isNull } from "drizzle-orm";

export async function insertAsset(input: typeof assets.$inferInsert) {
  const rows = await db.insert(assets).values(input).returning();
  return rows[0] ?? null;
}

export async function listAssetsForUser(userId: string) {
  return await db
    .select()
    .from(assets)
    .where(and(eq(assets.ownerUserId, userId), isNull(assets.orgId)))
    .orderBy(assets.createdAt)
    .limit(200);
}

export async function listAssetsForOrg(orgId: string) {
  return await db.select().from(assets).where(eq(assets.orgId, orgId)).orderBy(assets.createdAt).limit(200);
}

export async function getAssetById(assetId: string) {
  const rows = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteAssetById(assetId: string) {
  const rows = await db.delete(assets).where(eq(assets.id, assetId)).returning();
  return rows[0] ?? null;
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
}) {
  await db.execute(sql\`
    insert into billing_subscriptions (provider, provider_subscription_id, status, plan_id, org_id, updated_at)
    values (\${input.provider}, \${input.providerSubscriptionId}, \${input.status}, \${input.planId ?? null}, \${input.orgId ?? null}, now())
      on conflict (provider_subscription_id) do update set
      status = excluded.status,
      plan_id = excluded.plan_id,
      org_id = excluded.org_id,
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
import { orgs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function insertOrg(input: typeof orgs.$inferInsert) {
  const rows = await db.insert(orgs).values(input).returning();
  return rows[0] ?? null;
}

export async function getOrgById(id: string) {
  const rows = await db.select().from(orgs).where(eq(orgs.id, id)).limit(1);
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

export async function listOrgsForUser(userId: string) {
  const rows = await db
    .select({ org: orgs, membership: orgMembers })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId))
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
  const match = rows.find((r) => r.org.id === id);
  if (!match) return { ok: false as const, reason: "not_member" as const };
  return { ok: true as const, orgId: id, org: match.org, membership: match.membership };
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "orgs", "page.tsx"),
      `import { loadMyOrgs } from "@/lib/loaders/orgs.loader";
import { createOrg } from "@/lib/actions/orgs.actions";
import { setActiveOrg } from "@/lib/actions/orgs.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const rows = await loadMyOrgs();
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

