import { db } from "@/lib/db";
import { testdomains } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function getTestdomainById(input: { id: string; orgId: string }) {
  const rows = await db
    .select()
    .from(testdomains)
    .where(and(eq(testdomains.id, input.id), eq(testdomains.orgId, input.orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listTestdomain(input: { orgId: string }) {
  return await db.select().from(testdomains).where(eq(testdomains.orgId, input.orgId)).limit(200);
}

export async function insertTestdomain(input: typeof testdomains.$inferInsert) {
  const rows = await db.insert(testdomains).values(input).returning();
  return rows[0] ?? null;
}

export async function updateTestdomain(input: { id: string; orgId: string; patch: Partial<typeof testdomains.$inferInsert> }) {
  const rows = await db
    .update(testdomains)
    .set({ ...input.patch, updatedAt: new Date() })
    .where(and(eq(testdomains.id, input.id), eq(testdomains.orgId, input.orgId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteTestdomain(input: { id: string; orgId: string }) {
  const rows = await db.delete(testdomains).where(and(eq(testdomains.id, input.id), eq(testdomains.orgId, input.orgId))).returning();
  return rows[0] ?? null;
}
