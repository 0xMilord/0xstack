import Link from "next/link";
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
        <p className="text-sm text-muted-foreground">Org-scoped subscription read model (Dodo webhooks → DB).</p>
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
