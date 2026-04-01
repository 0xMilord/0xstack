import { getWebhookEvent, listWebhookEvents } from "@/lib/repos/webhook-events.repo";
import { revalidate } from "@/lib/cache";

function parsePayload(payloadJson: string) {
  try {
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

export async function webhookLedgerService_list(input: { provider?: string; eventType?: string; limit?: number }) {
  return await listWebhookEvents(input);
}

export async function webhookLedgerService_get(input: { provider: string; eventId: string }) {
  return await getWebhookEvent(input);
}

export async function webhookLedgerService_replay(input: { provider: string; eventId: string }) {
  const row = await getWebhookEvent({ provider: input.provider, eventId: input.eventId });
  if (!row) return { ok: false as const, code: "not_found" as const };
  const payload = parsePayload((row as any).payloadJson);
  if (!payload) return { ok: false as const, code: "invalid_payload" as const };

  if (input.provider === "dodo") {
    const { reconcileBillingEvent } = await import("@/lib/services/billing.service");
    await reconcileBillingEvent(payload);
    revalidate.webhookLedger();
    return { ok: true as const, replayed: true as const };
  }

  return { ok: false as const, code: "provider_not_supported" as const };
}
