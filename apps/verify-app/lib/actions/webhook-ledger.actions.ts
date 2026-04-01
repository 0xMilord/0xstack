"use server";

import { requireAuth } from "@/lib/auth/server";
import { webhookLedgerReplayInput } from "@/lib/rules/webhook-ledger.rules";
import { webhookLedgerService_replay } from "@/lib/services/webhook-ledger.service";

export async function replayWebhookEventAction(input: unknown) {
  await requireAuth();
  const data = webhookLedgerReplayInput.parse(input);
  return await webhookLedgerService_replay(data);
}
