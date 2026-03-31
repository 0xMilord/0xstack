import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

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
