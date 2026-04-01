import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p className="text-sm text-muted-foreground">A pragmatic stack for real SaaS constraints: multi-tenant, secure, observable.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CQRS by default</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Reads use loaders + server cache; writes use server actions; external APIs call services only.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enterprise guardrails</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            `doctor` enforces boundaries and required surfaces so teams don’t accidentally break architecture.
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-2">
        <Link className={buttonVariants({ variant: "default" })} href="/contact">Contact</Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/terms">Terms</Link>
      </div>
    </main>
  );
}
