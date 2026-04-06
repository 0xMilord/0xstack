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
  if (!session?.user?.id) {
    await guardApiRequest(req);
  } else {
    await guardApiRequest(req, { max: 60, windowMs: 60_000 }, { requireApiKey: false });
  }
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
  if (!session?.user?.id) {
    await guardApiRequest(req);
  } else {
    await guardApiRequest(req, { max: 60, windowMs: 60_000 }, { requireApiKey: false });
  }
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
  if (!session?.user?.id) {
    await guardApiRequest(req);
  } else {
    await guardApiRequest(req, { max: 60, windowMs: 60_000 }, { requireApiKey: false });
  }
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
