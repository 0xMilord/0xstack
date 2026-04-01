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
      // Only remove shared billing routes when billing is fully disabled.
      // If another billing provider is enabled, it owns these routes.
      if (ctx.modules.billing === false) {
        for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      }
      // Only remove env schema when billing is fully disabled. If another provider is enabled,
      // we keep a stub so lib/env/schema.ts imports always resolve.
      if (ctx.modules.billing === false) {
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
  // Minimal v1 plan registry (align with Dodo plan registry later)
  STRIPE_STARTER_PRICE_ID: z.string().min(1),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "billing", "stripe.ts"),
      `import Stripe from "stripe";
import { env } from "@/lib/env/server";
\nexport function getStripe() {
  return new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: "2025-01-27" as any });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout", "route.ts"),
      `import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { getStripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env/server";
\nexport async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) await guardApiRequest(req);
    const body = (await req.json().catch(() => null)) as null | { priceId?: string; quantity?: number; orgId?: string };
    const priceId = body?.priceId ?? env.STRIPE_STARTER_PRICE_ID!;
    const quantity = typeof body?.quantity === "number" && body.quantity > 0 ? Math.floor(body.quantity) : 1;
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity }],
      success_url: env.STRIPE_RETURN_URL!,
      cancel_url: env.STRIPE_RETURN_URL!,
      metadata: { orgId: body?.orgId ?? "", userId: session?.user?.id ?? "" },
    });
    return NextResponse.json({ ok: true, requestId, url: checkout.url }, { headers: { "x-request-id": requestId } });
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
import { getStripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env/server";
\nexport async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) await guardApiRequest(req);
    const stripe = getStripe();
    // Minimal v1: caller must pass customerId. In app UX we will resolve via DB.
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    if (!customerId) return NextResponse.json({ ok: false, requestId, code: "INVALID_INPUT", message: "customerId required" }, { status: 400, headers: { "x-request-id": requestId } });
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: env.STRIPE_RETURN_URL!,
    });
    return NextResponse.json({ ok: true, requestId, url: portal.url }, { headers: { "x-request-id": requestId } });
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
\nexport async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, requestId, code: "UNAUTHORIZED", message: "missing_stripe_signature" }, { status: 401, headers: { "x-request-id": requestId } });
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET!);
    await reconcileBillingEvent({ ...event, provider: "stripe" });
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

