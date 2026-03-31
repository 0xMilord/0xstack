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
import { eq } from "drizzle-orm";

export async function get${pascal}ById(id: string) {
  const rows = await db.select().from(${plural}).where(eq(${plural}.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function list${pascal}() {
  return await db.select().from(${plural}).limit(100);
}

export async function insert${pascal}(input: typeof ${plural}.$inferInsert) {
  const rows = await db.insert(${plural}).values(input).returning();
  return rows[0] ?? null;
}

export async function update${pascal}(id: string, patch: Partial<typeof ${plural}.$inferInsert>) {
  const rows = await db.update(${plural}).set({ ...patch, updatedAt: new Date() }).where(eq(${plural}.id, id)).returning();
  return rows[0] ?? null;
}

export async function delete${pascal}(id: string) {
  const rows = await db.delete(${plural}).where(eq(${plural}.id, id)).returning();
  return rows[0] ?? null;
}
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "services", `${plural}.service.ts`),
    `import { delete${pascal}, get${pascal}ById, insert${pascal}, list${pascal}, update${pascal} } from "@/lib/repos/${plural}.repo";

export async function ${camel}Service_list() {
  return await list${pascal}();
}

export async function ${camel}Service_getById(id: string) {
  return await get${pascal}ById(id);
}

export async function ${camel}Service_create(input: { id: string; name: string; orgId?: string | null; createdByUserId?: string | null }) {
  return await insert${pascal}({
    id: input.id,
    name: input.name,
    orgId: input.orgId ?? null,
    createdByUserId: input.createdByUserId ?? null,
    updatedAt: new Date(),
  });
}

export async function ${camel}Service_update(id: string, patch: { name?: string }) {
  return await update${pascal}(id, patch);
}

export async function ${camel}Service_delete(id: string) {
  return await delete${pascal}(id);
}
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "loaders", `${plural}.loader.ts`),
    `import { cache } from "react";
import { ${camel}Service_list } from "@/lib/services/${plural}.service";

export const load${pascal}List = cache(async () => {
  return await ${camel}Service_list();
});
`
  );

  await writeFileEnsured(
    path.join(input.projectRoot, "lib", "rules", `${plural}.rules.ts`),
    `import { z } from "zod";

export const create${pascal}Input = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  orgId: z.string().min(1).optional(),
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

import { revalidatePath } from "next/cache";
import { create${pascal}Input, delete${pascal}Input, update${pascal}Input } from "@/lib/rules/${plural}.rules";
import { requireAuth } from "@/lib/auth/server";
import { ${camel}Service_create, ${camel}Service_delete, ${camel}Service_update } from "@/lib/services/${plural}.service";

export async function create${pascal}(input: unknown) {
  const session = await requireAuth();
  const data = create${pascal}Input.parse(input);
  const created = await ${camel}Service_create({
    id: data.id,
    name: data.name,
    orgId: data.orgId ?? null,
    createdByUserId: (session as any)?.user?.id ?? null,
  });
  revalidatePath("/app");
  return { ok: true, data: created };
}

export async function update${pascal}(input: unknown) {
  await requireAuth();
  const data = update${pascal}Input.parse(input);
  const updated = await ${camel}Service_update(data.id, { name: data.name });
  revalidatePath("/app");
  return { ok: true, data: updated };
}

export async function delete${pascal}(input: unknown) {
  await requireAuth();
  const data = delete${pascal}Input.parse(input);
  const deleted = await ${camel}Service_delete(data.id);
  revalidatePath("/app");
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
import { create${pascal} } from "@/lib/actions/${plural}.actions";

async function fetch${pascal}List() {
  const res = await fetch("/api/v1/${plural}", { method: "GET" });
  if (!res.ok) throw new Error("Failed to load ${plural}");
  const json = (await res.json()) as any;
  return (json?.data ?? []) as any[];
}

export function use${pascal}List() {
  return useQuery({ queryKey: ${camel}Keys.list(), queryFn: fetch${pascal}List });
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
          await create${pascal}({ id: String(fd.get("id") ?? ""), name: String(fd.get("name") ?? "") });
        }}
      >
        <Input name="id" placeholder="id" required />
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
    const data = await ${camel}Service_list();
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
  it("validates input", () => {
    expect(() => create${pascal}Input.parse({ id: "x" })).not.toThrow();
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

