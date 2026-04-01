import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { pushSubscriptionsService_unsubscribe } from "@/lib/services/push-subscriptions.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }

  // Accept either { endpoint } or full subscription JSON.
  const body = await req.json().catch(() => ({} as any));
  const endpoint = body?.endpoint ?? body?.subscription?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ ok: false, error: "invalid_endpoint", requestId }, { status: 400 });
  }

  await pushSubscriptionsService_unsubscribe(session.user.id, endpoint);
  return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } });
}
