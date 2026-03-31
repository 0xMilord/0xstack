import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageGcsModule: Module = {
  id: "storage-gcs",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "gcs";
    const routes = [
      "app/api/v1/storage/sign-upload/route.ts",
      "app/api/v1/storage/sign-read/route.ts",
      "app/api/v1/storage/assets/route.ts",
      "app/api/v1/storage/assets/[assetId]/route.ts",
    ];
    if (!enabled) {
      for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      await backupAndRemove(ctx.projectRoot, "lib/storage/gcs.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "mutation-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-read"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]"));
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
import { insertAsset, deleteAssetById, listAssetsForOrg, listAssetsForUser } from "@/lib/repos/assets.repo";
import { assets } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

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

export async function storageService_createSignedRead(input: { assetId: string }) {
  const rows = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1);
  const a = rows[0];
  if (!a) throw new Error("Asset not found");
  const bucket = getGcs().bucket(a.bucket);
  const file = bucket.file(a.objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { url, expiresInSeconds: 600, asset: a };
}

export async function storageService_deleteAsset(input: { assetId: string }) {
  const deleted = await deleteAssetById(input.assetId);
  if (!deleted) return { ok: false as const };
  try {
    const bucket = getGcs().bucket(deleted.bucket);
    await bucket.file(deleted.objectKey).delete({ ignoreNotFound: true });
  } catch {
    // best-effort: DB is source of truth
  }
  return { ok: true as const, deleted };
}

export async function storageService_listAssets(input: { ownerUserId?: string | null; orgId?: string | null }) {
  if (input.orgId) return await listAssetsForOrg(input.orgId);
  if (input.ownerUserId) return await listAssetsForUser(input.ownerUserId);
  return [];
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

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-read", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_createSignedRead } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    await guardApiRequest(req);
    const body = (await req.json().catch(() => null)) as null | { assetId?: string };
    const assetId = body?.assetId;
    if (!assetId) {
      return NextResponse.json({ ok: false, requestId, code: "INVALID_INPUT", message: "assetId is required" }, { status: 400 });
    }
    const signed = await storageService_createSignedRead({ assetId });
    return NextResponse.json({ ok: true, requestId, ...signed }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "assets.keys.ts"),
      `export const assetsKeys = {
  all: ["assets"] as const,
  mine: () => [...assetsKeys.all, "mine"] as const,
  org: (orgId: string) => [...assetsKeys.all, "org", orgId] as const,
};
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "mutation-keys", "assets.keys.ts"),
      `export const assetsMutations = {
  delete: ["assets", "delete"] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { storageService_listAssets } from "@/lib/services/storage.service";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const assets = await storageService_listAssets({ ownerUserId: session.user.id, orgId: null });
  return NextResponse.json({ ok: true, requestId, assets });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { storageService_deleteAsset } from "@/lib/services/storage.service";

export async function DELETE(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const { assetId } = await ctx.params;
  const res = await storageService_deleteAsset({ assetId });
  return NextResponse.json({ ok: true, requestId, ...res });
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

