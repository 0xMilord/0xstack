import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { getGcs } from "@/lib/storage/gcs";
import {
  insertAsset,
  deleteAssetById,
  getAssetById,
  listAssetsForOrg,
  listAssetsForUser,
} from "@/lib/repos/assets.repo";
import type { assets } from "@/lib/db/schema";
import { isMember } from "@/lib/repos/org-members.repo";

export function storageService_buildObjectKey(input: { orgId: string | null; ownerUserId: string | null; filename: string }) {
  const safe =
    (input.filename || "upload.bin").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160) || "upload.bin";
  if (input.orgId) return `orgs/${input.orgId}/${crypto.randomUUID()}-${safe}`;
  if (input.ownerUserId) return `users/${input.ownerUserId}/${crypto.randomUUID()}-${safe}`;
  throw new Error("object_key_owner_required");
}

export async function storageService_assertCanAccessAsset(input: {
  userId: string;
  activeOrgId: string | null;
  asset: typeof assets.$inferSelect;
}) {
  const a = input.asset;
  if (a.orgId) {
    if (!input.activeOrgId || a.orgId !== input.activeOrgId) throw new Error("forbidden");
    const ok = await isMember(a.orgId, input.userId);
    if (!ok) throw new Error("forbidden");
    return;
  }
  if (a.ownerUserId !== input.userId) throw new Error("forbidden");
}

export async function storageService_createSignedUpload(input: {
  contentType: string;
  objectKey: string;
  ownerUserId: string | null;
  orgId: string | null;
}) {
  const bucket = getGcs().bucket(env.GCS_BUCKET!);
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
    provider: "gcs",
    ownerUserId: input.ownerUserId,
    orgId: input.orgId,
    bucket: env.GCS_BUCKET!,
    objectKey: input.objectKey,
    contentType: input.contentType,
  });

  return { assetId, bucket: env.GCS_BUCKET!, objectKey: input.objectKey, uploadUrl, expiresInSeconds: 900 };
}

export async function storageService_createSignedRead(input: {
  assetId: string;
  userId?: string | null;
  activeOrgId?: string | null;
}) {
  const asset = await getAssetById(input.assetId);
  if (!asset) throw new Error("Asset not found");
  if (input.userId) {
    await storageService_assertCanAccessAsset({
      userId: input.userId,
      activeOrgId: input.activeOrgId ?? null,
      asset,
    });
  }
  const bucket = getGcs().bucket(asset.bucket);
  const file = bucket.file(asset.objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { url, expiresInSeconds: 600, asset };
}

export async function storageService_getAssetForViewer(input: { assetId: string; userId: string; activeOrgId: string | null }) {
  const asset = await getAssetById(input.assetId);
  if (!asset) return null;
  await storageService_assertCanAccessAsset({ userId: input.userId, activeOrgId: input.activeOrgId, asset });
  return asset;
}

export async function storageService_deleteAsset(input: {
  assetId: string;
  userId?: string | null;
  activeOrgId?: string | null;
}) {
  const existing = await getAssetById(input.assetId);
  if (!existing) return { ok: false as const };
  if (input.userId) {
    await storageService_assertCanAccessAsset({
      userId: input.userId,
      activeOrgId: input.activeOrgId ?? null,
      asset: existing,
    });
  }
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
