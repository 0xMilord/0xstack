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
      for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      await backupAndRemove(ctx.projectRoot, "lib/billing/dodo.webhooks.ts");
      await backupAndRemove(ctx.projectRoot, "lib/services/billing.service.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "billing", "webhook"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "billing"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
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
      path.join(ctx.projectRoot, "lib", "services", "billing.service.ts"),
      `import { log } from "@/lib/utils/logger";
import { upsertBillingCustomer, upsertBillingSubscription } from "@/lib/repos/billing.repo";

type AnyObj = Record<string, any>;

function pick(obj: AnyObj, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.length) return v;
  }
  return null;
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

  log("info", "billing.webhook.reconciled", { type, dodoCustomerId, subscriptionId, status });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "checkout", "route.ts"),
      `import { Checkout } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { guardApiRequest } from "@/lib/security/api";

const handler = Checkout({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  returnUrl: env.DODO_PAYMENTS_RETURN_URL,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
  type: "session",
});

export async function POST(req: Request) {
  await guardApiRequest(req);
  return handler(req);
}

const getHandler = Checkout({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  returnUrl: env.DODO_PAYMENTS_RETURN_URL,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
  type: "static",
});

export async function GET(req: Request) {
  await guardApiRequest(req);
  return getHandler(req);
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "billing", "portal", "route.ts"),
      `import { CustomerPortal } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { guardApiRequest } from "@/lib/security/api";

const handler = CustomerPortal({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
});

export async function GET(req: Request) {
  await guardApiRequest(req);
  return handler(req);
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
  webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY,
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
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "billing"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "pricing", "page.tsx"),
      `import Link from "next/link";
import { env } from "@/lib/env/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  const priceId = env.DODO_PAYMENTS_STARTER_PRICE_ID;
  const href = "/api/v1/billing/checkout?price_id=" + encodeURIComponent(priceId);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">Start a subscription and manage billing from your dashboard.</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Starter</CardTitle>
            <CardDescription>Production-ready baseline for a single team.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>Auth + orgs</li>
              <li>Storage + assets index</li>
              <li>Billing reconciliation tables</li>
              <li>PWA + cache + observability foundations</li>
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href={href}>Start subscription</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href="/app/billing">Manage billing</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "billing", "success", "page.tsx"),
      `import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Payment successful</h1>
      <p className="text-sm text-muted-foreground">Your subscription should be active shortly after webhook reconciliation.</p>
      <div className="flex gap-2">
        <Button asChild><Link href="/app/billing">Go to billing</Link></Button>
        <Button asChild variant="secondary"><Link href="/app">Go to app</Link></Button>
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "billing", "cancel", "page.tsx"),
      `import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
      <p className="text-sm text-muted-foreground">No payment was taken. You can restart checkout anytime.</p>
      <div className="flex gap-2">
        <Button asChild><Link href="/pricing">Back to pricing</Link></Button>
        <Button asChild variant="secondary"><Link href="/">Home</Link></Button>
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "billing", "page.tsx"),
      `import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Checkout, customer portal, and subscription status live here.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/pricing">View pricing</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href="/api/v1/billing/portal">Open customer portal</Link>
          </Button>
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

