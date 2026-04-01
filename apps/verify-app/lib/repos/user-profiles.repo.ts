import { db } from "@/lib/db";
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
