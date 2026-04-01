import { db } from "@/lib/db";
import { billingCustomers, billingSubscriptions } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function upsertBillingCustomer(input: {
  userId: string;
  dodoCustomerId?: string | null;
  stripeCustomerId?: string | null;
}) {
  await db.execute(sql`
    insert into billing_customers (user_id, dodo_customer_id, stripe_customer_id)
    values (${input.userId}, ${input.dodoCustomerId ?? null}, ${input.stripeCustomerId ?? null})
    on conflict (user_id) do update set
      dodo_customer_id = coalesce(excluded.dodo_customer_id, billing_customers.dodo_customer_id),
      stripe_customer_id = coalesce(excluded.stripe_customer_id, billing_customers.stripe_customer_id)
  `);
}

export async function getStripeCustomerIdForUser(userId: string) {
  const rows = await db
    .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);
  const id = rows[0]?.stripeCustomerId;
  return id && id.length ? id : null;
}

export async function upsertBillingSubscription(input: {
  provider: string;
  providerSubscriptionId: string;
  status: string;
  planId?: string | null;
  orgId?: string | null;
}) {
  await db.execute(sql`
    insert into billing_subscriptions (provider, provider_subscription_id, status, plan_id, org_id, updated_at)
    values (${input.provider}, ${input.providerSubscriptionId}, ${input.status}, ${input.planId ?? null}, ${input.orgId ?? null}, now())
      on conflict (provider_subscription_id) do update set
      status = excluded.status,
      plan_id = excluded.plan_id,
      org_id = excluded.org_id,
      updated_at = now()
  `);
}

export async function getLatestBillingSubscriptionForOrg(orgId: string) {
  const rows = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.orgId, orgId))
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}
