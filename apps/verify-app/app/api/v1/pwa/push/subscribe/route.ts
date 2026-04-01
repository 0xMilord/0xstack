import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { pushSubscriptionsService_subscribe } from "@/lib/services/push-subscriptions.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }

  const body = await req.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ ok: false, error: "invalid_subscription", requestId }, { status: 400 });
  }

  await pushSubscriptionsService_subscribe(session.user.id, body);
  return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } });
}
