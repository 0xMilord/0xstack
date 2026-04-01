import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export async function upsertWebhookEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  payloadJson: unknown;
}) {
  if (!input.eventId) return { inserted: false, reason: "missing_event_id" as const };
  try {
    await db.execute(sql`
      insert into webhook_events (provider, event_id, event_type, payload_json)
      values (${input.provider}, ${input.eventId}, ${input.eventType}, ${JSON.stringify(input.payloadJson)})
      on conflict (provider, event_id) do nothing
    `);
    return { inserted: true as const };
  } catch {
    return { inserted: false as const, reason: "db_error" as const };
  }
}

export async function listWebhookEvents(input: {
  provider?: string;
  eventType?: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const where = and(
    input.provider ? eq(webhookEvents.provider, input.provider) : undefined,
    input.eventType ? eq(webhookEvents.eventType, input.eventType) : undefined
  );
  return await db
    .select()
    .from(webhookEvents)
    .where(where as any)
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(limit);
}

export async function getWebhookEvent(input: { provider: string; eventId: string }) {
  const rows = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, input.provider), eq(webhookEvents.eventId, input.eventId)))
    .limit(1);
  return rows[0] ?? null;
}
