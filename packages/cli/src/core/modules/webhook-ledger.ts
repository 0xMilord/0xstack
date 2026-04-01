import type { Module } from "./types";
import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import { ensureWebhookEventsTable } from "../generate/schema-edit";

export const webhookLedgerModule: Module = {
  id: "webhook-ledger",
  install: async () => {},
  activate: async (ctx) => {
    // Core table + repo used by multiple webhook providers.
    await ensureWebhookEventsTable(ctx.projectRoot);
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "rules"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "webhooks"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "webhooks", "ledger", "events"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "webhooks", "ledger", "events", "[provider]", "[eventId]", "replay"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "webhook-events.repo.ts"),
      `import { db } from "@/lib/db";
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
    await db.execute(sql\`
      insert into webhook_events (provider, event_id, event_type, payload_json)
      values (\${input.provider}, \${input.eventId}, \${input.eventType}, \${JSON.stringify(input.payloadJson)})
      on conflict (provider, event_id) do nothing
    \`);
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "webhook-ledger.service.ts"),
      `import { getWebhookEvent, listWebhookEvents } from "@/lib/repos/webhook-events.repo";
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "webhook-ledger.keys.ts"),
      `export const webhookLedgerKeys = {
  all: ["webhook-ledger"] as const,
  list: (input: { provider?: string; eventType?: string }) => [...webhookLedgerKeys.all, "list", input] as const,
  event: (provider: string, eventId: string) => [...webhookLedgerKeys.all, "event", provider, eventId] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "rules", "webhook-ledger.rules.ts"),
      `import { z } from "zod";

export const webhookLedgerListInput = z.object({
  provider: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const webhookLedgerReplayInput = z.object({
  provider: z.string().min(1),
  eventId: z.string().min(1),
});
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "webhook-ledger.loader.ts"),
      `import { cache } from "react";
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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "webhook-ledger.actions.ts"),
      `"use server";

import { requireAuth } from "@/lib/auth/server";
import { webhookLedgerReplayInput } from "@/lib/rules/webhook-ledger.rules";
import { webhookLedgerService_replay } from "@/lib/services/webhook-ledger.service";

export async function replayWebhookEventAction(input: unknown) {
  await requireAuth();
  const data = webhookLedgerReplayInput.parse(input);
  return await webhookLedgerService_replay(data);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "webhooks", "ledger", "events", "route.ts"),
      `import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { webhookLedgerListInput } from "@/lib/rules/webhook-ledger.rules";
import { webhookLedgerService_list } from "@/lib/services/webhook-ledger.service";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    await guardApiRequest(req);
    const url = new URL(req.url);
    const data = webhookLedgerListInput.parse({
      provider: url.searchParams.get("provider") ?? undefined,
      eventType: url.searchParams.get("eventType") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const rows = await webhookLedgerService_list(data);
    return NextResponse.json({ ok: true, requestId, rows }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "webhooks", "ledger", "events", "[provider]", "[eventId]", "replay", "route.ts"),
      `import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { webhookLedgerService_replay } from "@/lib/services/webhook-ledger.service";

export async function POST(_req: Request, ctx: { params: Promise<{ provider: string; eventId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const params = await ctx.params;
    await guardApiRequest(_req);
    const res = await webhookLedgerService_replay({ provider: params.provider, eventId: params.eventId });
    return NextResponse.json({ ok: true, requestId, res }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "webhooks", "page.tsx"),
      `import { loadWebhookLedger } from "@/lib/loaders/webhook-ledger.loader";
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
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

