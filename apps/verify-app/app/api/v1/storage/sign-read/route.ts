import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_createSignedRead } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = (await req.json().catch(() => null)) as null | { assetId?: string };
    const assetId = body?.assetId;
    if (!assetId) {
      return NextResponse.json({ ok: false, requestId, code: "INVALID_INPUT", message: "assetId is required" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      const orgId = getActiveOrgIdFromCookies(await cookies());
      const signed = await storageService_createSignedRead({
        assetId,
        userId: session.user.id,
        activeOrgId: orgId,
      });
      return NextResponse.json({ ok: true, requestId, ...signed }, { headers: { "x-request-id": requestId } });
    }

    await guardApiRequest(req);
    const signed = await storageService_createSignedRead({ assetId });
    return NextResponse.json({ ok: true, requestId, ...signed }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
