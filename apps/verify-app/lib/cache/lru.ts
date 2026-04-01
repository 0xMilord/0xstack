import { LRUCache } from "lru-cache";

const LRU_TTL_MS = 5 * 60 * 1000;
const LRU_MAX = 1000;

type Key = string;

const lru =
  (globalThis as any).__0xstack_lru ??
  ((globalThis as any).__0xstack_lru = new LRUCache<Key, any>({
    max: LRU_MAX,
    ttl: LRU_TTL_MS,
  }));

export async function l1GetOrSet<T>(key: Key, fn: () => Promise<T>): Promise<T> {
  const hit = lru.get(key) as T | undefined;
  if (hit !== undefined) return hit;
  const v = await fn();
  lru.set(key, v);
  return v;
}

export function stableKey(parts: unknown[]) {
  return parts.map((p) => (p == null ? "null" : typeof p === "string" ? p : JSON.stringify(p))).join("|");
}
