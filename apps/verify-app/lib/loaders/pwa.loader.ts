import { cache } from "react";
import { requireAuth } from "@/lib/auth/server";
import { env } from "@/lib/env/server";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { pushSubscriptionsService_list } from "@/lib/services/push-subscriptions.service";

const loadPushSubsCached = withServerCache(
  async (userId: string) => await pushSubscriptionsService_list(userId),
  {
    key: (userId: string) => ["pwa", "push-subs", userId],
    tags: (userId: string) => [cacheTags.pushSubsUser(userId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadPwaSettings = cache(async () => {
  const viewer = await requireAuth();
  const subs = await loadPushSubsCached(viewer.userId);
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error("missing_NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  return {
    viewer,
    vapidPublicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    subscriptions: subs,
  };
});
