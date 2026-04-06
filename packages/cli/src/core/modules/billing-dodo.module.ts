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
      await backupAndRemove(ctx.projectRoot, "lib/billing/dodo.webhooks.ts");
      if (ctx.modules.billing === false) {
        for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
        await backupAndRemove(ctx.projectRoot, "lib/env/billing.ts");
      }
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "webhook"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "billing"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "billing.ts"),
      `import { z } from "zod";
\nexport const BillingEnvSchema = z.object({
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]),
  DODO_PAYMENTS_RETURN_URL: z.string().url(),
  DODO_PAYMENTS_STARTER_PRICE_ID: z.string().min(1),
  DODO_PAYMENTS_PLANS_JSON: z.string().min(1).optional(),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

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

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout", "route.ts"),
      `import type { NextRequest } from "next/server";
import { env } from "@/lib/env/server";
import { auth } from "@/lib/auth/auth";
import { requireActiveOrg } from "@/lib/orgs/active-org";
import { getBillingPlans } from "@/lib/billing/plans";

/**
 * Create a Dodo checkout session with org + userId metadata encoded in the return URL.
 * Dodo does not support custom metadata in the hosted checkout, so we encode context
 * in the returnUrl and extract it during webhook reconciliation.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Resolve active org — checkout belongs to the active org
  const orgGate = await requireActiveOrg();
  const orgId = orgGate.org.id;
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const priceId = body.price_id ?? env.DODO_PAYMENTS_STARTER_PRICE_ID;
  const plans = getBillingPlans();
  const plan = plans.find((p: any) => p.priceId === priceId) ?? plans[0];

  // Encode org + user context in the return URL for webhook reconciliation
  const returnUrl = new URL(env.DODO_PAYMENTS_RETURN_URL);
  returnUrl.searchParams.set("orgId", orgId);
  returnUrl.searchParams.set("userId", userId);
  returnUrl.searchParams.set("planId", plan?.id ?? "");

  // Dodo hosted checkout — metadata is carried through the return URL
  const checkoutUrl = \`https://checkout.dodopayments.com/v1/checkout?price_id=\${encodeURIComponent(priceId)}&return_url=\${encodeURIComponent(returnUrl.toString())}&api_key=\${encodeURIComponent(env.DODO_PAYMENTS_API_KEY)}\`;

  return Response.json({ url: checkoutUrl, orgId, userId, planId: plan?.id });
}

/** Static link mode — redirect to Dodo checkout with org context in return URL. */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const orgGate = await requireActiveOrg();
  const orgId = orgGate.org.id;
  const userId = session.user.id;

  const url = new URL(req.url);
  const priceId = url.searchParams.get("price_id") ?? env.DODO_PAYMENTS_STARTER_PRICE_ID;

  const returnUrl = new URL(env.DODO_PAYMENTS_RETURN_URL);
  returnUrl.searchParams.set("orgId", orgId);
  returnUrl.searchParams.set("userId", userId);

  const checkoutUrl = \`https://checkout.dodopayments.com/v1/checkout?price_id=\${encodeURIComponent(priceId)}&return_url=\${encodeURIComponent(returnUrl.toString())}&api_key=\${encodeURIComponent(env.DODO_PAYMENTS_API_KEY)}\`;
  return Response.redirect(checkoutUrl, 302);
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal", "route.ts"),
      `import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { cookies } from "next/headers";
import { getStripeCustomerIdForOrg } from "@/lib/repos/billing.repo";
import { env } from "@/lib/env/server";
import { redirect } from "next/navigation";

/**
 * Redirect to Dodo customer portal for the active org.
 * Requires authenticated session + active org context.
 */
export async function GET(req: NextRequest) {
  const viewer = await requireAuth();
  const cookieStore = await cookies();
  const orgId = getActiveOrgIdFromCookies(cookieStore);

  if (!orgId) {
    return new Response(JSON.stringify({ error: "no_active_org" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Look up the customer ID for this org
  const customerId = await getStripeCustomerIdForOrg(orgId);
  if (!customerId) {
    return new Response(JSON.stringify({ error: "no_customer", message: "No subscription found for this org. Start a subscription first." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Dodo customer portal URL with customer ID
  const portalUrl = \`https://portal.dodopayments.com/v1/portal?customer_id=\${encodeURIComponent(customerId)}&api_key=\${encodeURIComponent(env.DODO_PAYMENTS_API_KEY)}\`;
  return Response.redirect(portalUrl, 302);
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
  },
  validate: async () => {},
  sync: async () => {},
};
