import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Payment successful</h1>
      <p className="text-sm text-muted-foreground">Your subscription should be active shortly after webhook reconciliation.</p>
      <div className="flex gap-2">
        <Link className={buttonVariants({ variant: "default" })} href="/app/billing">Go to billing</Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/app">Go to app</Link>
      </div>
    </main>
  );
}
