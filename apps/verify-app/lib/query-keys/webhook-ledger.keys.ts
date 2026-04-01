export const webhookLedgerKeys = {
  all: ["webhook-ledger"] as const,
  list: (input: { provider?: string; eventType?: string }) => [...webhookLedgerKeys.all, "list", input] as const,
  event: (provider: string, eventId: string) => [...webhookLedgerKeys.all, "event", provider, eventId] as const,
};
