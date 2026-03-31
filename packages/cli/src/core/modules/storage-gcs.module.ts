import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageGcsModule: Module = {
  id: "storage-gcs",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "gcs";
    const routes = ["app/api/v1/storage/sign-upload/route.ts"];
    if (!enabled) {
      for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      await backupAndRemove(ctx.projectRoot, "lib/storage/gcs.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "storage.ts"),
      `import { z } from "zod";
\nexport const StorageEnvSchema = z.object({
  GCS_BUCKET: z.string().min(1),
  GCS_PROJECT_ID: z.string().min(1),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "gcs.ts"),
      `import { Storage } from "@google-cloud/storage";
import { env } from "@/lib/env/server";

export function getGcs() {
  return new Storage({ projectId: env.GCS_PROJECT_ID });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "storage.service.ts"),
      `import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { getGcs } from "@/lib/storage/gcs";
import { insertAsset } from "@/lib/repos/assets.repo";

export async function storageService_createSignedUpload(input: {
  contentType: string;
  objectKey: string;
  ownerUserId: string | null;
  orgId: string | null;
}) {
  const bucket = getGcs().bucket(env.GCS_BUCKET);
  const file = bucket.file(input.objectKey);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: input.contentType,
  });

  const assetId = crypto.randomUUID();
  await insertAsset({
    id: assetId,
    ownerUserId: input.ownerUserId,
    orgId: input.orgId,
    bucket: env.GCS_BUCKET,
    objectKey: input.objectKey,
    contentType: input.contentType,
  });

  return { assetId, bucket: env.GCS_BUCKET, objectKey: input.objectKey, uploadUrl, expiresInSeconds: 900 };
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_createSignedUpload } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    await guardApiRequest(req);

    const body = (await req.json().catch(() => null)) as null | {
      contentType?: string;
      objectKey?: string;
      ownerUserId?: string;
      orgId?: string;
    };
    const contentType = body?.contentType ?? "application/octet-stream";
    const objectKey = body?.objectKey ?? \`uploads/\${crypto.randomUUID()}\`;
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
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

