import crypto from "node:crypto";
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
