import { loadWebhookLedger } from "@/lib/loaders/webhook-ledger.loader";
import { replayWebhookEventAction } from "@/lib/actions/webhook-ledger.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function Page() {
  const rows = await loadWebhookLedger({ limit: 50 });
  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Webhook ledger</h1>
        <p className="text-sm text-muted-foreground">Inspection + replay for recorded webhook events.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.length ? (
            rows.map((r: any) => (
              <div key={r.provider + ":" + r.eventId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.provider} · {r.eventType}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{r.eventId}</p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await replayWebhookEventAction({ provider: String(r.provider), eventId: String(r.eventId) });
                  }}
                >
                  <button className={buttonVariants({ variant: "outline" })} type="submit">Replay</button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No events yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
