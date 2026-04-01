import { db } from "@/lib/db";
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
