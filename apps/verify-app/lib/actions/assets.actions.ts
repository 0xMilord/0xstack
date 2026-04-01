"use server";

import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { revalidate } from "@/lib/cache";
import { storageService_buildObjectKey, storageService_createSignedRead, storageService_createSignedUpload, storageService_deleteAsset } from "@/lib/services/storage.service";

export async function assetsSignUploadAction(input: { filename: string; contentType: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const objectKey = storageService_buildObjectKey({ orgId, ownerUserId: null, filename: input.filename });
  const signed = await storageService_createSignedUpload({ contentType: input.contentType, objectKey, ownerUserId: viewer.userId, orgId });
  revalidate.assetsForOrg(orgId);
  return signed;
}

export async function assetsSignReadAction(input: { assetId: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const signed = await storageService_createSignedRead({ assetId: input.assetId, userId: viewer.userId, activeOrgId: orgId });
  return { url: signed.url };
}

export async function assetsDeleteAction(input: { assetId: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const res = await storageService_deleteAsset({ assetId: input.assetId, userId: viewer.userId, activeOrgId: orgId });
  if (orgId) revalidate.assetsForOrg(orgId);
  return res;
}
