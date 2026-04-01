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
  // collections
  projects: "projects",
  companies: "companies",
  jobs: "jobs",
  posts: "posts",
  trending: "trending",
  dashboard: "dashboard",
  viewer: "viewer",

  // entity helpers
  project: (slug: string) => \`project-slug:\${slug}\`,
  company: (slug: string) => \`company:\${slug}\`,
  user: (username: string) => \`user:\${username}\`,
  dashboardUser: (userId: string) => \`dashboard:\${userId}\`,
  viewerUser: (userId: string) => \`viewer:\${userId}\`,
  orgsForUser: (userId: string) => \`orgs:user:\${userId}\`,
  billingOrg: (orgId: string) => \`billing:org:\${orgId}\`,
  assetsOrg: (orgId: string) => \`assets:org:\${orgId}\`,
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

export function withServerCache<A extends any[], T>(
  fn: (...args: A) => MaybePromise<T>,
  opt: CacheOptions<A>
) {
  return async (...args: A) => {
    if (process.env.OXSTACK_CACHE_DISABLED === "1") {
      return await fn(...args);
    }
    const keyParts = opt.key(...args);
    const key = stableKey(keyParts);

    const cached = unstable_cache(
      async () => await fn(...args),
      keyParts.map((x) => (typeof x === "string" ? x : JSON.stringify(x))),
      { tags: opt.tags(...args), revalidate: opt.revalidate }
    );

    return await l1GetOrSet(key, cached);
  };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "cache", "revalidate.ts"),
      `import { revalidateTag } from "next/cache";
import { cacheTags } from "@/lib/cache/config";

export const revalidate = {
  tag: (tag: string) => revalidateTag(tag, "page"),
  project: (slug: string) => {
    revalidateTag(cacheTags.projects, "page");
    revalidateTag(cacheTags.project(slug), "page");
  },
  company: (slug: string) => {
    revalidateTag(cacheTags.companies, "page");
    revalidateTag(cacheTags.company(slug), "page");
  },
  posts: () => {
    revalidateTag(cacheTags.posts, "page");
    revalidateTag(cacheTags.trending, "page");
  },
  dashboard: (userId: string) => {
    revalidateTag(cacheTags.dashboard, "page");
    revalidateTag(cacheTags.dashboardUser(userId), "page");
  },
  orgs: (userId: string) => {
    revalidateTag(cacheTags.orgsForUser(userId), "page");
    revalidateTag(cacheTags.dashboard, "page");
  },
  billingForOrg: (orgId: string) => {
    revalidateTag(cacheTags.billingOrg(orgId), "page");
  },
  assetsForOrg: (orgId: string) => {
    revalidateTag(cacheTags.assetsOrg(orgId), "page");
  },
  pwaForUser: (userId: string) => {
    revalidateTag(cacheTags.pushSubsUser(userId), "page");
  },
  webhookLedger: () => {
    revalidateTag(cacheTags.webhookLedger, "page");
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

