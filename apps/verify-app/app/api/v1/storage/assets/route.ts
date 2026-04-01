import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { storageService_listAssets } from "@/lib/services/storage.service";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const assets = orgId
    ? await storageService_listAssets({ orgId })
    : await storageService_listAssets({ ownerUserId: session.user.id, orgId: null });
  return NextResponse.json({ ok: true, requestId, assets, scope: orgId ? "org" : "personal" });
}
