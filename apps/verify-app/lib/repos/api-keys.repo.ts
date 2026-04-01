import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, isNull, and, desc, sql } from "drizzle-orm";

export async function findActiveApiKeysByPrefix(prefix: string) {
  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(5);
}

export async function listActiveApiKeysForOrg(orgId: string) {
  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt))
    .limit(200);
}

export async function insertApiKey(input: { id: string; orgId: string; name: string; prefix: string; hash: string }) {
  const rows = await db
    .insert(apiKeys)
    .values({ id: input.id, orgId: input.orgId, name: input.name, prefix: input.prefix, hash: input.hash })
    .returning();
  return rows[0] ?? null;
}

export async function revokeApiKey(input: { id: string; orgId: string }) {
  await db.execute(sql`
    update api_keys set revoked_at = now()
    where id = ${input.id} and org_id = ${input.orgId} and revoked_at is null
  `);
}
