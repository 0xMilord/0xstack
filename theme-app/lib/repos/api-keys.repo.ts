import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

export async function findActiveApiKeysByPrefix(prefix: string) {
  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(5);
}
