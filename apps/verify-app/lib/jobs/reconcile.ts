import { webhookLedgerService_list, webhookLedgerService_replay } from "@/lib/services/webhook-ledger.service";

export async function jobs_runReconcile() {
  // Production baseline: replay recent provider webhooks into durable read models.
  // Today we support "dodo" (billing) replay. Extend here for other providers.
  const rows = await webhookLedgerService_list({ provider: "dodo", limit: 50 });
  let replayed = 0;
  for (const r of rows as any[]) {
    const res = await webhookLedgerService_replay({ provider: String(r.provider), eventId: String(r.eventId) });
    if ((res as any)?.ok) replayed += 1;
  }
  return { attempted: rows.length, replayed };
}
