"use server";

import { requireAuth } from "@/lib/auth/server";
import { revalidate } from "@/lib/cache";
import { pushService_sendToUser } from "@/lib/services/push.service";
import { pushSubscriptionsService_unsubscribe } from "@/lib/services/push-subscriptions.service";

export async function pwaSendTestPushAction(input?: { title?: string; body?: string }) {
  const viewer = await requireAuth();
  const res = await pushService_sendToUser({
    userId: viewer.userId,
    payload: { title: input?.title ?? "Test push", body: input?.body, url: "/app/pwa", tag: "test-push" },
  });
  revalidate.pwaForUser(viewer.userId);
  return { ok: true as const, ...res };
}

export async function pwaUnsubscribeEndpointAction(input: { endpoint: string }) {
  const viewer = await requireAuth();
  await pushSubscriptionsService_unsubscribe(viewer.userId, input.endpoint);
  revalidate.pwaForUser(viewer.userId);
  return { ok: true as const };
}
