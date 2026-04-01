import { cache } from "react";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { webhookLedgerService_list } from "@/lib/services/webhook-ledger.service";

const loadLedgerCached = withServerCache(
  async (input: { provider?: string; eventType?: string; limit?: number }) => await webhookLedgerService_list(input),
  {
    key: (input) => ["webhook-ledger", "list", input],
    tags: () => [cacheTags.webhookLedger],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadWebhookLedger = cache(async (input: { provider?: string; eventType?: string; limit?: number }) => {
  return await loadLedgerCached(input);
});
