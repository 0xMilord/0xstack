import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_buildObjectKey, storageService_createSignedUpload } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      const orgId = getActiveOrgIdFromCookies(await cookies());
      if (!orgId) {
        return NextResponse.json(
          { ok: false, requestId, code: "NO_ACTIVE_ORG", message: "Select an organization first (/app/orgs)." },
          { status: 400, headers: { "x-request-id": requestId } }
        );
      }
      await orgsService_assertMember({ userId: session.user.id, orgId });
      const body = (await req.json().catch(() => ({}))) as {
        contentType?: string;
        filename?: string;
      };
      const contentType = body?.contentType ?? "application/octet-stream";
      const objectKey = storageService_buildObjectKey({
        orgId,
        ownerUserId: null,
        filename: typeof body?.filename === "string" ? body.filename : "upload.bin",
      });
      const signed = await storageService_createSignedUpload({
        contentType,
        objectKey,
        ownerUserId: session.user.id,
        orgId,
      });
      return NextResponse.json(
        { ok: true, requestId, ...signed, ownerUserId: session.user.id, orgId },
        { headers: { "x-request-id": requestId } }
      );
    }

    await guardApiRequest(req);

    const body = (await req.json().catch(() => null)) as null | {
      contentType?: string;
      objectKey?: string;
      ownerUserId?: string;
      orgId?: string;
    };
    const contentType = body?.contentType ?? "application/octet-stream";
    const objectKey = body?.objectKey ?? `uploads/${crypto.randomUUID()}`;
    const ownerUserId = body?.ownerUserId ?? null;
    const orgId = body?.orgId ?? null;
    if (!ownerUserId && !orgId) {
      return NextResponse.json(
        { ok: false, requestId, code: "INVALID_INPUT", message: "ownerUserId or orgId is required" },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const signed = await storageService_createSignedUpload({ contentType, objectKey, ownerUserId, orgId });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        ...signed,
        ownerUserId,
        orgId,
      },
      { headers: { "x-request-id": requestId } }
    );
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
