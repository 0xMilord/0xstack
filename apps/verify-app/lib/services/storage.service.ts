import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { ACTIVE_STORAGE_PROVIDER } from "@/lib/storage/runtime";
import {
  insertAsset,
  deleteAssetById,
  getAssetById,
  listAssetsForOrg,
  listAssetsForUser,
} from "@/lib/repos/assets.repo";
import type { assets } from "@/lib/db/schema";
import { isMember } from "@/lib/repos/org-members.repo";
import type { ProviderSignUploadResult } from "@/lib/storage/provider";

function storageBucket(): string {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return env.GCS_BUCKET!;
    case "s3":
      return env.S3_BUCKET!;
    case "supabase":
      return env.SUPABASE_STORAGE_BUCKET!;
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

async function providerSignUpload(input: { objectKey: string; contentType: string }): Promise<ProviderSignUploadResult> {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return (await import("@/lib/storage/providers/gcs")).providerSignUpload(input);
    case "s3":
      return (await import("@/lib/storage/providers/s3")).providerSignUpload(input);
    case "supabase":
      return (await import("@/lib/storage/providers/supabase")).providerSignUpload(input);
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

async function providerSignRead(input: { bucket: string; objectKey: string }) {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return (await import("@/lib/storage/providers/gcs")).providerSignRead(input);
    case "s3":
      return (await import("@/lib/storage/providers/s3")).providerSignRead(input);
    case "supabase":
      return (await import("@/lib/storage/providers/supabase")).providerSignRead(input);
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

async function providerDeleteObject(input: { bucket: string; objectKey: string }) {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return (await import("@/lib/storage/providers/gcs")).providerDeleteObject(input);
    case "s3":
      return (await import("@/lib/storage/providers/s3")).providerDeleteObject(input);
    case "supabase":
      return (await import("@/lib/storage/providers/supabase")).providerDeleteObject(input);
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

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
  const bucket = storageBucket();
  const signed = await providerSignUpload({ objectKey: input.objectKey, contentType: input.contentType });
  const headers: Record<string, string> = {
    ...(signed.headers ?? {}),
  };
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = input.contentType;
  }

  const assetId = crypto.randomUUID();
  await insertAsset({
    id: assetId,
    provider: ACTIVE_STORAGE_PROVIDER,
    ownerUserId: input.ownerUserId,
    orgId: input.orgId,
    bucket,
    objectKey: input.objectKey,
    contentType: input.contentType,
  });

  return {
    assetId,
    bucket,
    objectKey: input.objectKey,
    uploadUrl: signed.uploadUrl,
    uploadHeaders: headers,
    expiresInSeconds: 900,
  };
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
  const { url } = await providerSignRead({ bucket: asset.bucket, objectKey: asset.objectKey });
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
    await providerDeleteObject({ bucket: deleted.bucket, objectKey: deleted.objectKey });
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
