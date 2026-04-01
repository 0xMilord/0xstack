import { Webhooks } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { reconcileBillingEvent } from "@/lib/services/billing.service";
import { upsertWebhookEvent } from "@/lib/repos/webhook-events.repo";

export const POST = Webhooks({
  webhookKey: (() => {
    const key = env.DODO_PAYMENTS_WEBHOOK_KEY;
    if (!key) throw new Error("Missing DODO_PAYMENTS_WEBHOOK_KEY");
    return key;
  })(),
  onPayload: async (payload) => {
    // Durable idempotency ledger: insert first (unique provider+event_id), then process.
    // If your payload doesn't contain a stable event id, adjust mapping here.
    await upsertWebhookEvent({
      provider: "dodo",
      eventId: String((payload as any)?.id ?? (payload as any)?.event_id ?? ""),
      eventType: String((payload as any)?.type ?? ""),
      payloadJson: payload,
    });
    await reconcileBillingEvent(payload);
  },
});
