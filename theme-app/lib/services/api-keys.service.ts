import crypto from "node:crypto";
import { findActiveApiKeysByPrefix } from "@/lib/repos/api-keys.repo";

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
