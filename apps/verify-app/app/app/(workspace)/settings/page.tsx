import Link from "next/link";
import { loadViewer } from "@/lib/loaders/viewer.loader";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/lib/actions/auth.actions";

export default async function Page() {
  const viewer = await loadViewer();
  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {viewer ? "Signed in as " + (viewer.email ?? viewer.userId) : "You are not signed in."}
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/orgs">Organizations</Link>
            <form action={signOutAction}>
              <button className={buttonVariants({ variant: "outline" })} type="submit" disabled={!viewer}>
                Sign out
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing & storage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/pricing">Pricing</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/billing">Billing</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/assets">Assets</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/api-keys">API keys</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/pwa">PWA</Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/webhooks">Webhooks</Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
