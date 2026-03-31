import Link from "next/link";
import { loadViewer } from "@/lib/loaders/viewer.loader";
import { Button } from "@/components/ui/button";
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
            <Button asChild variant="secondary">
              <Link href="/app/orgs">Organizations</Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" disabled={!viewer}>
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing & storage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="secondary">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/assets">Assets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
