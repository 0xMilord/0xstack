import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Ship a production app in days.</h1>
          <p className="text-base text-muted-foreground">
            0xstack gives you auth, orgs, billing, storage, jobs, and enterprise guardrails with a strict CQRS contract.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className={buttonVariants({ variant: "default" })} href="/get-started">Get started</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/pricing">View pricing</Link>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What’s included</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>Better Auth + Drizzle (Postgres)</li>
              <li>Org-scoped workspace with hardened boundaries</li>
              <li>Storage (GCS) signed URLs + asset index</li>
              <li>Billing (Dodo) webhook ledger + subscription read model</li>
            </ul>
            <div className="pt-2">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/app/orgs">Open app</Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
