import path from "node:path";
import { writeFileEnsured, ensureDir } from "../modules/fs-utils";
import { pluralize, toCamel, toKebab, toPascal } from "./names";
import { upsertDomainTable } from "./schema-edit";

export type GenerateDomainInput = {
  projectRoot: string;
  domain: string;
  withApi: boolean;
};

export async function runGenerateDomain(input: GenerateDomainInput) {
  const domain = toKebab(input.domain);
  const plural = pluralize(domain);
  const camel = toCamel(domain);
  const pascal = toPascal(domain);

  // DB: add a basic table (text IDs; aligns with Better Auth text strategy)
  await upsertDomainTable(
    input.projectRoot,
    plural,
    `export const ${plural} = pgTable("${plural}", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  name: text("name").notNull(),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});`
  );

  // Repo / Loader / Rules / Actions
  await ensureDir(path.join(input.projectRoot, "lib", "repos"));
  await ensureDir(path.join(input.projectRoot, "lib", "loaders"));
  await ensureDir(path.join(input.projectRoot, "lib", "rules"));
  await ensureDir(path.join(input.projectRoot, "lib", "actions"));
  await ensureDir(path.join(input.projectRoot, "lib", "services"));
  await ensureDir(path.join(input.projectRoot, "lib", "query-keys"));
  await ensureDir(path.join(input.projectRoot, "lib", "mutation-keys"));
  await ensureDir(path.join(input.projectRoot, "lib", "hooks", "client"));

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "repos", `${plural}.repo.ts`),
    `import { db } from "@/lib/db";
import { ${plural} } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function get${pascal}ById(input: { id: string; orgId: string }) {
  const rows = await db
    .select()
    .from(${plural})
    .where(and(eq(${plural}.id, input.id), eq(${plural}.orgId, input.orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function list${pascal}(input: { orgId: string }) {
  return await db.select().from(${plural}).where(eq(${plural}.orgId, input.orgId)).limit(200);
}

export async function insert${pascal}(input: typeof ${plural}.$inferInsert) {
  const rows = await db.insert(${plural}).values(input).returning();
  return rows[0] ?? null;
}

export async function update${pascal}(input: { id: string; orgId: string; patch: Partial<typeof ${plural}.$inferInsert> }) {
  const rows = await db
    .update(${plural})
    .set({ ...input.patch, updatedAt: new Date() })
    .where(and(eq(${plural}.id, input.id), eq(${plural}.orgId, input.orgId)))
    .returning();
  return rows[0] ?? null;
}

export async function delete${pascal}(input: { id: string; orgId: string }) {
  const rows = await db.delete(${plural}).where(and(eq(${plural}.id, input.id), eq(${plural}.orgId, input.orgId))).returning();
  return rows[0] ?? null;
}
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "services", `${plural}.service.ts`),
    `import crypto from "node:crypto";
import { delete${pascal}, get${pascal}ById, insert${pascal}, list${pascal}, update${pascal} } from "@/lib/repos/${plural}.repo";

export async function ${camel}Service_list(input: { orgId: string }) {
  return await list${pascal}({ orgId: input.orgId });
}

export async function ${camel}Service_getById(input: { id: string; orgId: string }) {
  return await get${pascal}ById({ id: input.id, orgId: input.orgId });
}

export async function ${camel}Service_create(input: { orgId: string; name: string; createdByUserId: string }) {
  return await insert${pascal}({
    id: crypto.randomUUID(),
    name: input.name,
    orgId: input.orgId,
    createdByUserId: input.createdByUserId,
    updatedAt: new Date(),
  });
}

export async function ${camel}Service_update(input: { id: string; orgId: string; patch: { name?: string } }) {
  return await update${pascal}({ id: input.id, orgId: input.orgId, patch: input.patch });
}

export async function ${camel}Service_delete(input: { id: string; orgId: string }) {
  return await delete${pascal}({ id: input.id, orgId: input.orgId });
}
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "loaders", `${plural}.loader.ts`),
    `import { cache } from "react";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { ${camel}Service_list } from "@/lib/services/${plural}.service";

const load${pascal}ListCached = withServerCache(
  async (orgId: string) => await ${camel}Service_list({ orgId }),
  {
    key: (orgId: string) => ["${plural}", "org", orgId],
    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const load${pascal}List = cache(async () => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) return [];
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  return await load${pascal}ListCached(orgId);
});
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "rules", `${plural}.rules.ts`),
    `import { z } from "zod";

export const create${pascal}Input = z.object({
  name: z.string().min(1).max(200),
});

export const update${pascal}Input = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
});

export const delete${pascal}Input = z.object({
  id: z.string().min(1),
});
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "actions", `${plural}.actions.ts`),
    `"use server";

import { cookies } from "next/headers";
import { create${pascal}Input, delete${pascal}Input, update${pascal}Input } from "@/lib/rules/${plural}.rules";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { revalidate } from "@/lib/cache";
import { ${camel}Service_create, ${camel}Service_delete, ${camel}Service_list, ${camel}Service_update } from "@/lib/services/${plural}.service";

export async function list${pascal}ForViewer() {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  return await ${camel}Service_list({ orgId });
}

export async function create${pascal}(input: unknown) {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  const data = create${pascal}Input.parse(input);
  const created = await ${camel}Service_create({
    name: data.name,
    orgId,
    createdByUserId: session.userId,
  });
  revalidate.orgs(session.userId);
  return { ok: true, data: created };
}

export async function update${pascal}(input: unknown) {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  const data = update${pascal}Input.parse(input);
  const updated = await ${camel}Service_update({ id: data.id, orgId, patch: { name: data.name } });
  revalidate.orgs(session.userId);
  return { ok: true, data: updated };
}

export async function delete${pascal}(input: unknown) {
  const session = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: session.userId, orgId });
  const data = delete${pascal}Input.parse(input);
  const deleted = await ${camel}Service_delete({ id: data.id, orgId });
  revalidate.orgs(session.userId);
  return { ok: true, data: deleted };
}
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "query-keys", `${plural}.keys.ts`),
    `export const ${camel}Keys = {
  all: () => ["${plural}"] as const,
  list: () => ["${plural}", "list"] as const,
  detail: (id: string) => ["${plural}", "detail", id] as const,
};
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "mutation-keys", `${plural}.mutations.ts`),
    `export const ${camel}Mutations = {
  create: () => ["${plural}", "create"] as const,
};
`
  );

  if (input.withApi) {
    await writeFileEnsured(
      path.join(input.projectRoot, "lib", "hooks", "client", `use-${plural}.client.ts`),
      `"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ${camel}Keys } from "@/lib/query-keys/${plural}.keys";
import { ${camel}Mutations } from "@/lib/mutation-keys/${plural}.mutations";
import { create${pascal}, list${pascal}ForViewer } from "@/lib/actions/${plural}.actions";

export function use${pascal}List() {
  return useQuery({ queryKey: ${camel}Keys.list(), queryFn: () => list${pascal}ForViewer() });
}

export function useCreate${pascal}() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ${camel}Mutations.create(),
    mutationFn: async (input: unknown) => create${pascal}(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ${camel}Keys.all() });
    },
  });
}
`
    );
  }

  // UI stubs
  await ensureDir(path.join(input.projectRoot, "app", "app", plural));
  await writeFileEnsured(
    path.join(input.projectRoot, "app", "app", plural, "page.tsx"),
    `import { load${pascal}List } from "@/lib/loaders/${plural}.loader";
import { create${pascal} } from "@/lib/actions/${plural}.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const items = await load${pascal}List();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">${pascal}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage ${plural}.</p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        action={async (fd) => {
          "use server";
          await create${pascal}({ name: String(fd.get("name") ?? "") });
        }}
      >
        <Input name="name" placeholder="name" required />
        <Button type="submit">Create</Button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it: any) => (
          <Card key={String(it.id)}>
            <CardHeader>
              <CardTitle className="text-base">{String(it.name ?? it.id)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">id: {String(it.id)}</CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
`
  );

  // Optional external API route (v1)
  if (input.withApi) {
    await ensureDir(path.join(input.projectRoot, "app", "api", "v1", plural));
    await writeFileEnsured(
      path.join(input.projectRoot, "app", "api", "v1", plural, "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { ${camel}Service_list } from "@/lib/services/${plural}.service";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    await guardApiRequest(req);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId") ?? "";
    if (!orgId) {
      return NextResponse.json(
        { ok: false, code: "validation_error", message: "orgId query parameter required", requestId },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }
    const data = await ${camel}Service_list({ orgId });
    return NextResponse.json({ ok: true, requestId, data }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );
  }

  // Test stubs
  await ensureDir(path.join(input.projectRoot, "tests", plural));
  await writeFileEnsured(
    path.join(input.projectRoot, "tests", plural, `${plural}.repo.test.ts`),
    `import { describe, it, expect } from "vitest";

describe("${plural} repo", () => {
  it("has basic exports", async () => {
    const mod = await import("@/lib/repos/${plural}.repo");
    expect(typeof mod.list${pascal}).toBe("function");
    expect(typeof mod.get${pascal}ById).toBe("function");
  });
});
`
  );
  await writeFileEnsured(
    path.join(input.projectRoot, "tests", plural, `${plural}.rules.test.ts`),
    `import { describe, it, expect } from "vitest";
import { create${pascal}Input } from "@/lib/rules/${plural}.rules";

describe("${plural} rules", () => {
  it("validates create input", () => {
    expect(create${pascal}Input.parse({ name: "Hello" })).toEqual({ name: "Hello" });
  });
});
`
  );
  await writeFileEnsured(
    path.join(input.projectRoot, "tests", plural, `${plural}.actions.test.ts`),
    `import { describe, it, expect } from "vitest";
import { create${pascal}Input } from "@/lib/rules/${plural}.rules";

describe("${plural} actions", () => {
  it("create schema requires name", () => {
    expect(() => create${pascal}Input.parse({ id: "x" })).toThrow();
  });
});
`
  );
}

