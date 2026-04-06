import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const billingStripeModule: Module = {
  id: "billing-stripe",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.billing === "stripe";
    const routes = [
      "app/api/v1/billing/checkout/route.ts",
      "app/api/v1/billing/portal/route.ts",
      "app/api/v1/billing/webhook/route.ts",
    ];

    if (!enabled) {
      if (ctx.modules.billing === false) {
        for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
        await backupAndRemove(ctx.projectRoot, "lib/env/billing-stripe.ts");
      }
      await backupAndRemove(ctx.projectRoot, "lib/billing/stripe.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "webhook"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "billing"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "billing-stripe.ts"),
      `import { z } from "zod";
\nexport const BillingStripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_RETURN_URL: z.string().url(),
  STRIPE_STARTER_PRICE_ID: z.string().min(1),
  STRIPE_PLANS_JSON: z.string().min(1).optional(),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "billing", "stripe.ts"),
      `import Stripe from "stripe";
import { env } from "@/lib/env/server";
import { getStripeCustomerIdForUser } from "@/lib/repos/billing.repo";

export function getStripe() {
  return new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" });
}

export async function stripeCreateCheckoutSession(input: { priceId: string; orgId: string; userId: string }) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: env.STRIPE_RETURN_URL!,
    cancel_url: env.STRIPE_RETURN_URL!,
    metadata: { orgId: input.orgId, userId: input.userId },
    subscription_data: {
      metadata: { orgId: input.orgId, userId: input.userId },
    },
  });
  const url = session.url;
  if (!url) throw new Error("stripe_checkout_no_url");
  return url;
}

export async function stripeCreateBillingPortalUrl(input: { userId: string }) {
  const stripe = getStripe();
  const customerId = await getStripeCustomerIdForUser(input.userId);
  if (!customerId) throw new Error("stripe_no_customer");
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: env.STRIPE_RETURN_URL!,
  });
  const url = portal.url;
  if (!url) throw new Error("stripe_portal_no_url");
  return url;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout", "route.ts"),
      `import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { stripeCreateCheckoutSession } from "@/lib/billing/stripe";
import { env } from "@/lib/env/server";
\nexport async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      await guardApiRequest(req);
    } else {
      await guardApiRequest(req, { max: 60, windowMs: 60_000 }, { requireApiKey: false });
    }
    const body = (await req.json().catch(() => null)) as null | { priceId?: string; quantity?: number; orgId?: string };
    const priceId = body?.priceId ?? env.STRIPE_STARTER_PRICE_ID!;
    const orgId = body?.orgId ?? "";
    const userId = session?.user?.id ?? "";
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, requestId, code: "INVALID_INPUT", message: "orgId and authenticated user required" },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }
    const url = await stripeCreateCheckoutSession({ priceId, orgId, userId });
    return NextResponse.json({ ok: true, requestId, url }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal", "route.ts"),
      `import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { stripeCreateBillingPortalUrl } from "@/lib/billing/stripe";
\nexport async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      await guardApiRequest(req);
    } else {
      await guardApiRequest(req, { max: 60, windowMs: 60_000 }, { requireApiKey: false });
    }
    const url = new URL(req.url);
    const asJson = url.searchParams.get("format") === "json";
    const portalUrl = await stripeCreateBillingPortalUrl({ userId: session.user.id });
    if (asJson) {
      return NextResponse.json({ ok: true, requestId, url: portalUrl }, { headers: { "x-request-id": requestId } });
    }
    return NextResponse.redirect(portalUrl);
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "webhook", "route.ts"),
      `import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/security/api";
import { getStripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env/server";
import { reconcileBillingEvent } from "@/lib/services/billing.service";
import { upsertWebhookEvent } from "@/lib/repos/webhook-events.repo";
\nexport async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, requestId, code: "UNAUTHORIZED", message: "missing_stripe_signature" }, { status: 401, headers: { "x-request-id": requestId } });
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET!);
    await upsertWebhookEvent({
      provider: "stripe",
      eventId: String(event.id),
      eventType: event.type,
      payloadJson: event as unknown,
    });
    await reconcileBillingEvent({ ...(event as any), provider: "stripe" });
    return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};
