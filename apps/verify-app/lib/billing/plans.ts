import { env } from "@/lib/env/server";

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
