import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { jobs_runReconcile } from "@/lib/jobs/reconcile";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    // Prefer server-to-server auth:
    // - API key (standard external surface)
    // - or job secret header (simple cron)
    const h = await headers();
    const secret = h.get("x-job-secret");
    if (!secret) await guardApiRequest(req);
    const res = await jobs_runReconcile();
    return NextResponse.json({ ok: true, requestId, ...res }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
