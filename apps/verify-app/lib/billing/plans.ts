import { env } from "@/lib/env/server";
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
