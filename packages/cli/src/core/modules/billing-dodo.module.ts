import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const billingDodoModule: Module = {
  id: "billing-dodo",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.billing === "dodo";
    const routes = [
      "app/api/v1/billing/checkout/route.ts",
      "app/api/v1/billing/portal/route.ts",
      "app/api/v1/billing/webhook/route.ts",
    ];
    if (!enabled) {
      // Only remove shared billing routes when billing is fully disabled.
      // If another billing provider is enabled, it owns these routes.
      if (ctx.modules.billing === false) {
        for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      }
      await backupAndRemove(ctx.projectRoot, "lib/billing/dodo.webhooks.ts");
      await backupAndRemove(ctx.projectRoot, "lib/billing/plans.ts");
      await backupAndRemove(ctx.projectRoot, "lib/services/billing.service.ts");
      await backupAndRemove(ctx.projectRoot, "lib/loaders/billing.loader.ts");
      await backupAndRemove(ctx.projectRoot, "lib/query-keys/billing.keys.ts");
      await backupAndRemove(ctx.projectRoot, "lib/actions/billing.actions.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "webhook"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "billing"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));

    // Extend env schema (merge-friendly by append) for billing keys.
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "billing.ts"),
      `import { z } from "zod";
\nexport const BillingEnvSchema = z.object({
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]),
  DODO_PAYMENTS_RETURN_URL: z.string().url(),
  // Used by /pricing. Dodo "price id" or equivalent identifier (per your Dodo dashboard).
  DODO_PAYMENTS_STARTER_PRICE_ID: z.string().min(1),
  // Optional: JSON plan registry for multiple plans.
  // Example: [{"id":"starter","name":"Starter","priceId":"price_xxx","features":["..."]}]
  DODO_PAYMENTS_PLANS_JSON: z.string().min(1).optional(),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "billing", "plans.ts"),
      `import { env } from "@/lib/env/server";

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

export function getBillingPlans(): BillingPlan[] {
  const json = env.DODO_PAYMENTS_PLANS_JSON;
  if (json) {
    const parsed = safeJsonParse(json);
    if (Array.isArray(parsed)) {
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
    }
  }

  const starter = env.DODO_PAYMENTS_STARTER_PRICE_ID;
  if (!starter) throw new Error("Missing DODO_PAYMENTS_STARTER_PRICE_ID");
  return [
    {
      id: "starter",
      name: "Starter",
      description: "Production-ready baseline for a single team.",
      priceId: starter,
      features: ["Auth + orgs", "Storage + assets index", "Billing reconciliation tables", "PWA + cache + observability foundations"],
    },
  ];
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "billing", "dodo.webhooks.ts"),
      `import { Webhook } from "standardwebhooks";

export function verifyDodoWebhook(rawBody: string, headers: Record<string, string | null | undefined>, webhookKey: string) {
  const hook = new Webhook(webhookKey);
  return hook.verify(rawBody, {
    "webhook-id": headers["webhook-id"] ?? "",
    "webhook-signature": headers["webhook-signature"] ?? "",
    "webhook-timestamp": headers["webhook-timestamp"] ?? "",
  });
}
`
    );

    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
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
      path.join(ctx.projectRoot, "lib", "services", "billing.service.ts"),
      `import { log } from "@/lib/utils/logger";
import { revalidate } from "@/lib/cache";
import { getLatestBillingSubscriptionForOrg, upsertBillingCustomer, upsertBillingSubscription } from "@/lib/repos/billing.repo";

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

export async function reconcileBillingEvent(event: unknown) {
  const e = (event ?? {}) as AnyObj;
  const type = String(e.type ?? e.event_type ?? "unknown");

  // Dodo payload shapes can evolve; we reconcile best-effort into durable DB state.
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

  log("info", "billing.webhook.reconciled", { type, dodoCustomerId, subscriptionId, status, orgId });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout", "route.ts"),
      `import type { NextRequest } from "next/server";
import { Checkout } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { guardApiRequest } from "@/lib/security/api";
import { auth } from "@/lib/auth/auth";

const handler = Checkout({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  returnUrl: env.DODO_PAYMENTS_RETURN_URL,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
  type: "session",
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);
  return handler(req as any);
}

const getHandler = Checkout({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  returnUrl: env.DODO_PAYMENTS_RETURN_URL,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
  type: "static",
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);
  return getHandler(req as any);
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal", "route.ts"),
      `import type { NextRequest } from "next/server";
import { CustomerPortal } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { guardApiRequest } from "@/lib/security/api";
import { auth } from "@/lib/auth/auth";

const handler = CustomerPortal({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);
  return handler(req as any);
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "webhook", "route.ts"),
      `import { Webhooks } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { reconcileBillingEvent } from "@/lib/services/billing.service";
import { upsertWebhookEvent } from "@/lib/repos/webhook-events.repo";

export const POST = Webhooks({
  webhookKey: (() => {
    const key = env.DODO_PAYMENTS_WEBHOOK_KEY;
    if (!key) throw new Error("Missing DODO_PAYMENTS_WEBHOOK_KEY");
    return key;
  })(),
  onPayload: async (payload) => {
    // Durable idempotency ledger: insert first (unique provider+event_id), then process.
    // If your payload doesn't contain a stable event id, adjust mapping here.
    await upsertWebhookEvent({
      provider: "dodo",
      eventId: String((payload as any)?.id ?? (payload as any)?.event_id ?? ""),
      eventType: String((payload as any)?.type ?? ""),
      payloadJson: payload,
    });
    await reconcileBillingEvent(payload);
  },
});
`
    );

    // Plug-and-play UX pages
    await ensureDir(path.join(ctx.projectRoot, "app", "billing", "success"));
    await ensureDir(path.join(ctx.projectRoot, "app", "billing", "cancel"));
    await backupAndRemove(ctx.projectRoot, "app/app/billing/page.tsx");
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "(workspace)", "billing"));

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

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "billing.actions.ts"),
      `"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { getBillingPlans } from "@/lib/billing/plans";

export async function startCheckoutAction(formData: FormData) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const planId = String(formData.get("planId") ?? "");
  const plan = getBillingPlans().find((p) => p.id === planId);
  if (!plan) throw new Error("plan_not_found");
  redirect("/api/v1/billing/checkout?price_id=" + encodeURIComponent(plan.priceId) + "&org_id=" + encodeURIComponent(orgId));
}

export async function openPortalAction() {
  await requireAuth();
  redirect("/api/v1/billing/portal");
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "(workspace)", "billing", "page.tsx"),
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
        <p className="text-sm text-muted-foreground">Org-scoped subscription read model (Dodo webhook → DB).</p>
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

