"use server";

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
