import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { toApiErrorResponse } from "@/lib/security/api";
import { storageService_deleteAsset } from "@/lib/services/storage.service";

export async function DELETE(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, requestId, code: "UNAUTHORIZED", message: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });
    }
    const { assetId } = await ctx.params;
    const orgId = getActiveOrgIdFromCookies(await cookies());
    const res = await storageService_deleteAsset({ assetId, userId: session.user.id, activeOrgId: orgId });
    return NextResponse.json({ requestId, ...res }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
