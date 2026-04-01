import { db } from "@/lib/db";
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
