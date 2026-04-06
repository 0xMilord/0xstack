import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const cacheModule: Module = {
  id: "cache",
  install: async () => {},
  activate: async (ctx) => {
    await ensureDir(path.join(ctx.projectRoot, "lib", "cache"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "cache", "config.ts"),
      `export const CACHE_TTL = {
  ENTITY_PAGE: 60 * 60 * 24, // 24h
  IDENTITY: 60 * 60, // 1h
  LISTING: 60 * 60, // 1h
  DASHBOARD: 60 * 10, // 10m
} as const;

export const cacheTags = {
  posts: "posts",
  dashboard: "dashboard",
  viewer: "viewer",

  dashboardUser: (userId: string) => \`dashboard:\${userId}\`,
  viewerUser: (userId: string) => \`viewer:\${userId}\`,
  orgsForUser: (userId: string) => \`orgs:user:\${userId}\`,
  /** Use for billing/subscription reads for an org. */
  billingOrg: (orgId: string) => \`billing:org:\${orgId}\`,
  assetsOrg: (orgId: string) => \`assets:org:\${orgId}\`,
  /** Domain list/detail cache for generated modules, e.g. domainOrg("materials", orgId). */
  domainOrg: (domainPlural: string, orgId: string) => \`\${domainPlural}:org:\${orgId}\`,
  apiKeysOrg: (orgId: string) => \`api-keys:org:\${orgId}\`,
  pushSubsUser: (userId: string) => \`pwa:push:user:\${userId}\`,
  webhookLedger: "webhooks:ledger",
} as const;
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "cache", "lru.ts"),
      `import { LRUCache } from "lru-cache";

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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "cache", "server.ts"),
      `import { unstable_cache } from "next/cache";
import { l1GetOrSet, stableKey } from "@/lib/cache/lru";

type MaybePromise<T> = T | Promise<T>;

export type CacheOptions<A extends any[]> = {
  key: (...args: A) => unknown[];
  tags: (...args: A) => string[];
  revalidate: number;
};

/**
 * Two-tier caching wrapper:
 * - L1: In-memory LRU cache (fast, per-instance)
 * - L2: Next.js unstable_cache (shared across requests, tag-based invalidation)
 *
 * Each unique key combination gets its own unstable_cache instance, memoized
 * in a Map so that repeated calls with the same args hit the Next.js cache.
 */
const cacheRegistry = new Map<string, (...args: any[]) => Promise<any>>();

export function withServerCache<A extends any[], T>(
  fn: (...args: A) => MaybePromise<T>,
  opt: CacheOptions<A>
) {
  return async (...args: A) => {
    if (process.env.OXSTACK_CACHE_DISABLED === "1") {
      return await fn(...args);
    }
    const keyParts = opt.key(...args);
    const stable = stableKey(keyParts);

    return await l1GetOrSet(stable, async () => {
      // Get or create a memoized unstable_cache for this specific key combination
      let cachedFn = cacheRegistry.get(stable);
      if (!cachedFn) {
        const tagKey = stableKey(keyParts);
        const tags = opt.tags(...args);
        const revalidate = opt.revalidate;
        cachedFn = unstable_cache(
          async (...a: A) => fn(...a),
          [tagKey],
          { tags, revalidate }
        );
        cacheRegistry.set(stable, cachedFn);
      }
      return (cachedFn as (...a: A) => Promise<T>)(...args);
    });
  };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "cache", "revalidate.ts"),
      `import { revalidatePath, revalidateTag } from "next/cache";
import { cacheTags } from "@/lib/cache/config";

export const revalidate = {
  tag: (tag: string) => revalidateTag(tag),
  path: (path: string, type?: "page" | "layout") => revalidatePath(path, type),
  posts: () => {
    revalidateTag(cacheTags.posts);
  },
  dashboard: (userId: string) => {
    revalidateTag(cacheTags.dashboard);
    revalidateTag(cacheTags.dashboardUser(userId));
  },
  orgs: (userId: string) => {
    revalidateTag(cacheTags.orgsForUser(userId));
    revalidateTag(cacheTags.dashboard);
  },
  billingForOrg: (orgId: string) => {
    revalidateTag(cacheTags.billingOrg(orgId));
  },
  assetsForOrg: (orgId: string) => {
    revalidateTag(cacheTags.assetsOrg(orgId));
  },
  domainOrg: (domainPlural: string, orgId: string) => {
    revalidateTag(cacheTags.domainOrg(domainPlural, orgId));
  },
  apiKeysForOrg: (orgId: string) => {
    revalidateTag(cacheTags.apiKeysOrg(orgId));
  },
  pwaForUser: (userId: string) => {
    revalidateTag(cacheTags.pushSubsUser(userId));
  },
  webhookLedger: () => {
    revalidateTag(cacheTags.webhookLedger);
  },
  /** Invalidate all org-scoped caches at once. */
  allForOrg: (orgId: string) => {
    revalidate.billingForOrg(orgId);
    revalidate.assetsForOrg(orgId);
    revalidate.apiKeysForOrg(orgId);
    // Domain caches use the orgId tag pattern; revalidate the dashboard too
    revalidateTag(cacheTags.dashboard);
  },
  viewer: () => {
    revalidateTag(cacheTags.viewer);
  },
} as const;
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "cache", "index.ts"),
      `export * from "@/lib/cache/config";
export * from "@/lib/cache/server";
export * from "@/lib/cache/revalidate";
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

