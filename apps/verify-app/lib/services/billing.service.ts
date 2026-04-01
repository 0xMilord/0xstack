import { log } from "@/lib/utils/logger";
import { revalidate } from "@/lib/cache";
import {
  getLatestBillingSubscriptionForOrg,
  upsertBillingCustomer,
  upsertBillingSubscription,
} from "@/lib/repos/billing.repo";

type AnyObj = Record<string, any>;

function pick(obj: AnyObj, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.length) return v;
  }
  return null;
}

export async function billingService_getLatestForOrg(orgId: string) {
  return await getLatestBillingSubscriptionForOrg(orgId);
}

async function reconcileDodoPayload(e: AnyObj) {
  const type = String(e.type ?? e.event_type ?? "unknown");
  const dodoCustomerId =
    pick(e.data ?? {}, ["customer_id"]) ?? pick(e, ["customer_id"]) ?? pick(e.data ?? {}, ["customerId"]);
  const userId = pick(e.data ?? {}, ["user_id", "userId"]) ?? pick(e, ["user_id", "userId"]);
  if (dodoCustomerId && userId) {
    await upsertBillingCustomer({ userId, dodoCustomerId });
  }

  const subscriptionId =
    pick(e.data ?? {}, ["subscription_id"]) ??
    pick(e, ["subscription_id"]) ??
    pick(e.data ?? {}, ["id"]) ??
    pick(e, ["id"]);
  const status = pick(e.data ?? {}, ["status"]) ?? pick(e, ["status"]) ?? "unknown";
  const planId = pick(e.data ?? {}, ["plan_id", "price_id", "product_id"]) ?? pick(e, ["plan_id"]);
  const orgId = pick(e.data ?? {}, ["org_id", "orgId"]) ?? pick(e, ["org_id", "orgId"]);

  if (subscriptionId) {
    await upsertBillingSubscription({
      provider: "dodo",
      providerSubscriptionId: subscriptionId,
      status,
      planId,
      orgId,
    });
  }

  if (orgId && subscriptionId) {
    revalidate.billingForOrg(String(orgId));
  }

  log("info", "billing.webhook.reconciled", { provider: "dodo", type, dodoCustomerId, subscriptionId, status, orgId });
}

async function reconcileStripePayload(e: AnyObj) {
  const type = String(e.type ?? "unknown");
  const obj = (e.data as AnyObj)?.object ?? {};

  if (type === "checkout.session.completed") {
    const session = obj;
    const userId = session.metadata?.userId ? String(session.metadata.userId) : null;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (userId && customerId) {
      await upsertBillingCustomer({ userId, stripeCustomerId: customerId });
    }
  }

  if (type.startsWith("customer.subscription.")) {
    const sub = obj;
    const subId = sub.id ? String(sub.id) : null;
    const status = sub.status ? String(sub.status) : "unknown";
    const orgId = sub.metadata?.orgId ? String(sub.metadata.orgId) : null;
    const planId = sub.items?.data?.[0]?.price?.id ? String(sub.items.data[0].price.id) : null;
    if (subId) {
      await upsertBillingSubscription({
        provider: "stripe",
        providerSubscriptionId: subId,
        status,
        planId,
        orgId,
      });
    }
    if (orgId) revalidate.billingForOrg(orgId);
  }

  log("info", "billing.webhook.reconciled", { provider: "stripe", type });
}

export async function reconcileBillingEvent(event: unknown) {
  const e = (event ?? {}) as AnyObj;
  if (e.provider === "stripe") {
    await reconcileStripePayload(e);
    return;
  }
  await reconcileDodoPayload(e);
}
