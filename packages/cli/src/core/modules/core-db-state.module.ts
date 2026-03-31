import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureApiKeysTable, ensureAssetsTable, ensureBillingTables, ensureOrgsTables } from "../generate/schema-edit";

export const coreDbStateModule: Module = {
  id: "orgs",
  install: async () => {},
  activate: async (ctx) => {
    await ensureOrgsTables(ctx.projectRoot);
    await ensureApiKeysTable(ctx.projectRoot);
    await ensureAssetsTable(ctx.projectRoot);
    await ensureBillingTables(ctx.projectRoot);

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

export async function insertAsset(input: typeof assets.$inferInsert) {
  const rows = await db.insert(assets).values(input).returning();
  return rows[0] ?? null;
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "billing.repo.ts"),
      `import { db } from "@/lib/db";
import { billingCustomers, billingSubscriptions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function upsertBillingCustomer(input: { userId: string; dodoCustomerId: string }) {
  await db.execute(sql\`
    insert into billing_customers (user_id, dodo_customer_id)
    values (\${input.userId}, \${input.dodoCustomerId})
    on conflict (dodo_customer_id) do nothing
  \`);
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
      path.join(ctx.projectRoot, "lib", "repos", "org-members.repo.ts"),
      `import { db } from "@/lib/db";
import { orgMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function addMember(input: typeof orgMembers.$inferInsert) {
  const rows = await db.insert(orgMembers).values(input).returning();
  return rows[0] ?? null;
}

export async function listOrgsForUser(userId: string) {
  // join via raw SQL-free approach: fetch memberships then map
  return await db.select().from(orgMembers).where(eq(orgMembers.userId, userId)).limit(200);
}

export async function isMember(orgId: string, userId: string) {
  const rows = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  return !!rows[0];
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "orgs.service.ts"),
      `import crypto from "node:crypto";
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
import { requireAuth } from "@/lib/auth/server";
import { createOrgInput } from "@/lib/rules/orgs.rules";
import { orgsService_createForUser } from "@/lib/services/orgs.service";

export async function createOrg(input: unknown) {
  const viewer = await requireAuth();
  const data = createOrgInput.parse(input);
  const org = await orgsService_createForUser({ userId: viewer.userId, name: data.name });
  revalidatePath("/app/orgs");
  return { ok: true, org };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "orgs", "page.tsx"),
      `import { orgsService_listForUser } from "@/lib/services/orgs.service";
import { getViewer } from "@/lib/auth/server";
import { createOrg } from "@/lib/actions/orgs.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const viewer = await getViewer();
  const memberships = viewer?.userId ? await orgsService_listForUser(viewer.userId) : [];
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Organizations</h1>
      <p className="mt-2 text-sm text-muted-foreground">Create an org and start building.</p>

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

      <pre className="mt-6 rounded border p-4 text-xs">{JSON.stringify(memberships, null, 2)}</pre>
    </main>
  );
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

