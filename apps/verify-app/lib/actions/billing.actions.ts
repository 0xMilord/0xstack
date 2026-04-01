"use server";

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
