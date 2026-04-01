import { unstable_cache } from "next/cache";
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
