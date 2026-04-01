import Link from "next/link";
import { cookies } from "next/headers";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { getBillingPlans } from "@/lib/billing/plans";
import { startCheckoutAction } from "@/lib/actions/billing.actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const plans = getBillingPlans();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">Start a subscription and manage billing from your dashboard.</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              {p.description ? <CardDescription>{p.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row">
              <form action={startCheckoutAction} className="w-full sm:w-auto">
                <input type="hidden" name="planId" value={p.id} />
                <button className={buttonVariants({ variant: "default" }) + " w-full sm:w-auto"} type="submit" disabled={!orgId}>
                  Start subscription
                </button>
              </form>
              <Link className={buttonVariants({ variant: "secondary" }) + " w-full sm:w-auto"} href="/app/billing">
                Manage billing
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {!orgId ? <p className="mt-4 text-sm text-muted-foreground">Select an organization first in the app to start checkout.</p> : null}
    </main>
  );
}
