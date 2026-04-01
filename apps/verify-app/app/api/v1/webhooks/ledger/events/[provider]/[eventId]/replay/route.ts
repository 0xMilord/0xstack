import crypto from "node:crypto";
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
