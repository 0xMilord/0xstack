import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
      <p className="text-sm text-muted-foreground">No payment was taken. You can restart checkout anytime.</p>
      <div className="flex gap-2">
        <Link className={buttonVariants({ variant: "default" })} href="/pricing">Back to pricing</Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/">Home</Link>
      </div>
    </main>
  );
}
