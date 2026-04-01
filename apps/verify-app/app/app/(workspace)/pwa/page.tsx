import { loadPwaSettings } from "@/lib/loaders/pwa.loader";
import { PwaClient } from "./pwa-client";
import { pwaSendTestPushAction, pwaUnsubscribeEndpointAction } from "@/lib/actions/pwa.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function Page() {
  const { vapidPublicKey, subscriptions } = await loadPwaSettings();
  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">PWA</h1>
        <p className="text-sm text-muted-foreground">Manage push notifications for your account.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PwaClient vapidPublicKey={vapidPublicKey} />
          <form
            action={async () => {
              "use server";
              await pwaSendTestPushAction({ title: "Hello from 0xstack", body: "This is a test push." });
            }}
          >
            <button className={buttonVariants({ variant: "outline" })} type="submit">
              Send test push
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {subscriptions.length ? (
            subscriptions.map((s: any) => (
              <div key={s.endpoint} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <p className="font-mono text-xs truncate">{s.endpoint}</p>
                <form
                  action={async () => {
                    "use server";
                    await pwaUnsubscribeEndpointAction({ endpoint: String(s.endpoint) });
                  }}
                >
                  <button className={buttonVariants({ variant: "outline" })} type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No active subscriptions yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
