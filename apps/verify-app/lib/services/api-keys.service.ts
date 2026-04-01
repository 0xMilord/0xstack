import crypto from "node:crypto";
import { findActiveApiKeysByPrefix, insertApiKey, listActiveApiKeysForOrg, revokeApiKey } from "@/lib/repos/api-keys.repo";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function verifyApiKey(key: string): Promise<boolean> {
  // Expected format: any string >= 10 chars. We use prefix for lookup.
  const prefix = key.slice(0, 8);
  if (!prefix || prefix.length < 4) return false;
  const candidates = await findActiveApiKeysByPrefix(prefix);
  const hash = sha256Hex(key);
  return candidates.some((c: any) => typeof c.hash === "string" && safeEqual(c.hash, hash));
}

export async function apiKeysService_listForOrg(orgId: string) {
  return await listActiveApiKeysForOrg(orgId);
}

export async function apiKeysService_createForOrg(input: { orgId: string; name: string }) {
  const id = crypto.randomUUID();
  // 0xstack_<prefix>.<secret>
  const secret = crypto.randomBytes(24).toString("base64url");
  const prefix = crypto.randomBytes(4).toString("hex"); // 8 chars
  const key = `0xstack_${prefix}.${secret}`;
  const hash = sha256Hex(key);
  const row = await insertApiKey({ id, orgId: input.orgId, name: input.name, prefix, hash });
  return { row, key };
}

export async function apiKeysService_revokeForOrg(input: { orgId: string; id: string }) {
  await revokeApiKey({ orgId: input.orgId, id: input.id });
}
