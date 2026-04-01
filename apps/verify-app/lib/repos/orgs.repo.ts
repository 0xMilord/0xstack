import { db } from "@/lib/db";
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
