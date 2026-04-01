import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

function billingOn(ctx: { modules: { billing: false | "dodo" | "stripe" } }) {
  return ctx.modules.billing !== false;
}

export const billingCoreModule: Module = {
  id: "billing-core",
  install: async () => {},
  activate: async (ctx) => {
    const on = billingOn(ctx);
    const provider = ctx.modules.billing;

    if (!on) {
      await backupAndRemove(ctx.projectRoot, "lib/billing/runtime.ts");
      await backupAndRemove(ctx.projectRoot, "lib/billing/plans.ts");
      await backupAndRemove(ctx.projectRoot, "lib/services/billing.service.ts");
      await backupAndRemove(ctx.projectRoot, "lib/loaders/billing.loader.ts");
      await backupAndRemove(ctx.projectRoot, "lib/query-keys/billing.keys.ts");
      await backupAndRemove(ctx.projectRoot, "lib/actions/billing.actions.ts");
      await backupAndRemove(ctx.projectRoot, "lib/hooks/client/use-billing.client.ts");
      await backupAndRemove(ctx.projectRoot, "app/pricing/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/billing/success/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/billing/cancel/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/(workspace)/billing/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/billing/page.tsx");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "billing"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "pricing"));
    await ensureDir(path.join(ctx.projectRoot, "app", "billing", "success"));
    await ensureDir(path.join(ctx.projectRoot, "app", "billing", "cancel"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "billing"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "hooks", "client"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "billing", "runtime.ts"),
      `export type ActiveBillingProvider = "dodo" | "stripe";

export const ACTIVE_BILLING_PROVIDER: ActiveBillingProvider = ${JSON.stringify(provider)};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "billing", "plans.ts"),
      `import { env } from "@/lib/env/server";
import { ACTIVE_BILLING_PROVIDER } from "@/lib/billing/runtime";

export type BillingPlan = {
  id: string;
  name: string;
  description?: string;
  priceId: string;
  features: string[];
};

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function plansFromJson(json: string | undefined) {
  if (!json) return null;
  const parsed = safeJsonParse(json);
  if (!Array.isArray(parsed)) return null;
  const plans = parsed
    .map((p: any) => ({
      id: String(p?.id ?? ""),
      name: String(p?.name ?? ""),
      description: typeof p?.description === "string" ? p.description : undefined,
      priceId: String(p?.priceId ?? p?.price_id ?? ""),
      features: Array.isArray(p?.features) ? p.features.map((x: any) => String(x)) : [],
    }))
    .filter((p) => p.id && p.name && p.priceId);
  if (plans.length) return plans;
  return null;
}

export function getBillingPlans(): BillingPlan[] {
  if (ACTIVE_BILLING_PROVIDER === "stripe") {
    const fromEnv = plansFromJson(env.STRIPE_PLANS_JSON);
    if (fromEnv) return fromEnv;
    const starter = env.STRIPE_STARTER_PRICE_ID;
    if (!starter) throw new Error("Missing STRIPE_STARTER_PRICE_ID");
    return [
      {
        id: "starter",
        name: "Starter",
        description: "Production-ready baseline for a single team.",
        priceId: starter,
        features: ["Auth + orgs", "Storage + assets", "Billing (Stripe)", "Cache + observability foundations"],
      },
    ];
  }

  const fromEnv = plansFromJson(env.DODO_PAYMENTS_PLANS_JSON);
  if (fromEnv) return fromEnv;

  const starter = env.DODO_PAYMENTS_STARTER_PRICE_ID;
  if (!starter) throw new Error("Missing DODO_PAYMENTS_STARTER_PRICE_ID");
  return [
    {
      id: "starter",
      name: "Starter",
      description: "Production-ready baseline for a single team.",
      priceId: starter,
      features: ["Auth + orgs", "Storage + assets", "Billing (Dodo)", "PWA + cache + observability foundations"],
    },
  ];
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "billing.service.ts"),
      `import { log } from "@/lib/utils/logger";
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "billing.keys.ts"),
      `export const billingKeys = {
  all: ["billing"] as const,
  org: (orgId: string) => [...billingKeys.all, "org", orgId] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "billing.loader.ts"),
      `import { cache } from "react";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { billingService_getLatestForOrg } from "@/lib/services/billing.service";

const loadBillingOrgCached = withServerCache(
  async (orgId: string) => await billingService_getLatestForOrg(orgId),
  {
    key: (orgId: string) => ["billing", "org", orgId],
    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadBillingForOrg = cache(async (orgId: string) => await loadBillingOrgCached(orgId));
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "billing.actions.ts"),
      `"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { getBillingPlans } from "@/lib/billing/plans";
import { ACTIVE_BILLING_PROVIDER } from "@/lib/billing/runtime";

export async function startCheckoutAction(formData: FormData) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const planId = String(formData.get("planId") ?? "");
  const plan = getBillingPlans().find((p) => p.id === planId);
  if (!plan) throw new Error("plan_not_found");

  if (ACTIVE_BILLING_PROVIDER === "dodo") {
    redirect("/api/v1/billing/checkout?price_id=" + encodeURIComponent(plan.priceId) + "&org_id=" + encodeURIComponent(orgId));
  }

  const { stripeCreateCheckoutSession } = await import("@/lib/billing/stripe");
  const url = await stripeCreateCheckoutSession({
    priceId: plan.priceId,
    orgId,
    userId: viewer.userId,
  });
  redirect(url);
}

export async function openPortalAction() {
  const viewer = await requireAuth();
  if (ACTIVE_BILLING_PROVIDER === "dodo") {
    redirect("/api/v1/billing/portal");
  }
  const { stripeCreateBillingPortalUrl } = await import("@/lib/billing/stripe");
  const url = await stripeCreateBillingPortalUrl({ userId: viewer.userId });
  redirect(url);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "hooks", "client", "use-billing.client.ts"),
      `import { useQueryClient } from "@tanstack/react-query";
import { billingKeys } from "@/lib/query-keys/billing.keys";

export { billingKeys };

/** Invalidate billing queries after client-side flows; prefer RSC loaders for reads. */
export function useInvalidateBilling() {
  const qc = useQueryClient();
  return (orgId: string) => qc.invalidateQueries({ queryKey: billingKeys.org(orgId) });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "pricing", "page.tsx"),
      `import Link from "next/link";
import { cookies } from "next/headers";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { getBillingPlans } from "@/lib/billing/plans";
import { startCheckoutAction } from "@/lib/actions/billing.actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const plans = getBillingPlans();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">Start a subscription and manage billing from your dashboard.</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              {p.description ? <CardDescription>{p.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row">
              <form action={startCheckoutAction} className="w-full sm:w-auto">
                <input type="hidden" name="planId" value={p.id} />
                <button className={buttonVariants({ variant: "default" }) + " w-full sm:w-auto"} type="submit" disabled={!orgId}>
                  Start subscription
                </button>
              </form>
              <Link className={buttonVariants({ variant: "secondary" }) + " w-full sm:w-auto"} href="/app/billing">
                Manage billing
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {!orgId ? <p className="mt-4 text-sm text-muted-foreground">Select an organization first in the app to start checkout.</p> : null}
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "billing", "success", "page.tsx"),
      `import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Payment successful</h1>
      <p className="text-sm text-muted-foreground">Your subscription should be active shortly after webhook reconciliation.</p>
      <div className="flex gap-2">
        <Link className={buttonVariants({ variant: "default" })} href="/app/billing">Go to billing</Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/app">Go to app</Link>
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "billing", "cancel", "page.tsx"),
      `import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
      <p className="text-sm text-muted-foreground">No payment was taken. You can restart checkout anytime.</p>
      <div className="flex gap-2">
        <Link className={buttonVariants({ variant: "default" })} href="/pricing">Back to pricing</Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/">Home</Link>
      </div>
    </main>
  );
}
`
    );

    const billingSubtitle =
      provider === "stripe"
        ? "Org-scoped subscription read model (Stripe webhooks → DB)."
        : "Org-scoped subscription read model (Dodo webhooks → DB).";

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "billing", "page.tsx"),
      `import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { loadBillingForOrg } from "@/lib/loaders/billing.loader";
import { getBillingPlans } from "@/lib/billing/plans";
import { openPortalAction } from "@/lib/actions/billing.actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) redirect("/app/orgs");

  const sub = await loadBillingForOrg(orgId);
  const plan = sub?.planId ? getBillingPlans().find((p) => p.priceId === sub.planId || p.id === sub.planId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">${billingSubtitle}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {sub ? (
            <>
              <p>
                <span className="text-muted-foreground">Status:</span> {sub.status}
              </p>
              <p>
                <span className="text-muted-foreground">Plan:</span> {sub.planId ?? "—"}
              </p>
              {plan ? (
                <p>
                  <span className="text-muted-foreground">Plan name:</span> {plan.name}
                </p>
              ) : null}
              <p className="font-mono text-xs text-muted-foreground">Provider id: {sub.providerSubscriptionId}</p>
            </>
          ) : (
            <p className="text-muted-foreground">No subscription row for this org yet. Complete checkout and wait for webhook reconciliation.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link className={buttonVariants({ variant: "default" }) + " w-full sm:w-auto"} href="/pricing">View pricing</Link>
          <form action={openPortalAction} className="w-full sm:w-auto">
            <button className={buttonVariants({ variant: "secondary" }) + " w-full sm:w-auto"} type="submit">Open customer portal</button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};
