import { z } from "zod";

export const webhookLedgerListInput = z.object({
  provider: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const webhookLedgerReplayInput = z.object({
  provider: z.string().min(1),
  eventId: z.string().min(1),
});
