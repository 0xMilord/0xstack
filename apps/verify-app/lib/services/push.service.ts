import webpush from "web-push";
import { configureWebPush } from "@/lib/pwa/push";
import { deletePushSubscription } from "@/lib/repos/push-subscriptions.repo";
import { pushSubscriptionsService_list } from "@/lib/services/push-subscriptions.service";

export async function pushService_sendToUser(input: {
  userId: string;
  payload: {
    title: string;
    body?: string;
    url?: string;
    tag?: string;
    actions?: Array<{ action: string; title: string; icon?: string }>;
  };
}) {
  configureWebPush();
  const subs = await pushSubscriptionsService_list(input.userId);
  const json = JSON.stringify({
    title: input.payload.title,
    body: input.payload.body,
    tag: input.payload.tag,
    actions: input.payload.actions ?? [],
    data: { url: input.payload.url ?? "/" },
  });

  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
          json,
          { TTL: 86400 }
        );
        return { ok: true as const };
      } catch (e: any) {
        if (e?.statusCode === 410) {
          await deletePushSubscription(input.userId, s.endpoint);
        }
        throw e;
      }
    })
  );

  return {
    attempted: subs.length,
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
