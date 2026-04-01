import { Storage } from "@google-cloud/storage";
import { env } from "@/lib/env/server";
import type { ProviderSignReadResult, ProviderSignUploadResult } from "@/lib/storage/provider";

export async function providerSignUpload(input: { objectKey: string; contentType: string }): Promise<ProviderSignUploadResult> {
  const storage = new Storage({ projectId: env.GCS_PROJECT_ID! });
  const bucket = storage.bucket(env.GCS_BUCKET!);
  const file = bucket.file(input.objectKey);
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: input.contentType,
  });
  return { uploadUrl, headers: { "Content-Type": input.contentType } };
}

export async function providerSignRead(input: { bucket: string; objectKey: string }): Promise<ProviderSignReadResult> {
  const storage = new Storage({ projectId: env.GCS_PROJECT_ID! });
  const bucket = storage.bucket(input.bucket);
  const [url] = await bucket.file(input.objectKey).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { url };
}

export async function providerDeleteObject(input: { bucket: string; objectKey: string }) {
  const storage = new Storage({ projectId: env.GCS_PROJECT_ID! });
  await storage.bucket(input.bucket).file(input.objectKey).delete({ ignoreNotFound: true });
}
