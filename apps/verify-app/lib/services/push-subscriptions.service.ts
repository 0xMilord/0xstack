import type { PushSubscriptionInput } from "@/lib/repos/push-subscriptions.repo";
import {
  upsertPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
} from "@/lib/repos/push-subscriptions.repo";

export async function pushSubscriptionsService_subscribe(userId: string, sub: PushSubscriptionInput) {
  return await upsertPushSubscription(userId, sub);
}

export async function pushSubscriptionsService_unsubscribe(userId: string, endpoint: string) {
  return await deletePushSubscription(userId, endpoint);
}

export async function pushSubscriptionsService_list(userId: string) {
  return await listPushSubscriptions(userId);
}
