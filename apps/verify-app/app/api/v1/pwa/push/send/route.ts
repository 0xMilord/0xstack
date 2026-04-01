import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { pushService_sendToUser } from "@/lib/services/push.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : "Notification";
  const res = await pushService_sendToUser({
    userId: session.user.id,
    payload: {
      title,
      body: typeof body?.body === "string" ? body.body : undefined,
      url: typeof body?.url === "string" ? body.url : "/",
      tag: typeof body?.tag === "string" ? body.tag : undefined,
      actions: Array.isArray(body?.actions) ? body.actions : undefined,
    },
  });
  return NextResponse.json({ ok: true, requestId, ...res }, { headers: { "x-request-id": requestId } });
}
