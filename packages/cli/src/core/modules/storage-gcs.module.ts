import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageGcsModule: Module = {
  id: "storage-gcs",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "gcs";

    if (!enabled) {
      await backupAndRemove(ctx.projectRoot, "lib/storage/providers/gcs.ts");
      if (ctx.modules.storage === false) {
        await backupAndRemove(ctx.projectRoot, "lib/env/storage.ts");
      }
      await backupAndRemove(ctx.projectRoot, "lib/storage/gcs.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage", "providers"));

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
      path.join(ctx.projectRoot, "lib", "storage", "providers", "gcs.ts"),
      `import { Storage } from "@google-cloud/storage";
import { env } from "@/lib/env/server";
import type { ProviderSignReadResult, ProviderSignUploadResult } from "@/lib/storage/provider";

// Singleton — reuse the same Storage instance across calls.
let _gcsStorage: Storage | null = null;
function getStorage() {
  if (!_gcsStorage) {
    _gcsStorage = new Storage({ projectId: env.GCS_PROJECT_ID! });
  }
  return _gcsStorage;
}

export async function providerSignUpload(input: { objectKey: string; contentType: string; maxBytes?: number }): Promise<ProviderSignUploadResult> {
  const storage = getStorage();
  const bucket = storage.bucket(env.GCS_BUCKET!);
  const file = bucket.file(input.objectKey);
  const maxBytes = input.maxBytes ?? 50 * 1024 * 1024; // Default 50MB
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: input.contentType,
    extensionHeaders: {
      "x-goog-content-length-range": `0,${maxBytes}`,
    },
  });
  return { uploadUrl, headers: { "Content-Type": input.contentType } };
}

export async function providerSignRead(input: { bucket: string; objectKey: string }): Promise<ProviderSignReadResult> {
  const storage = getStorage();
  const bucket = storage.bucket(input.bucket);
  const [url] = await bucket.file(input.objectKey).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { url };
}

export async function providerDeleteObject(input: { bucket: string; objectKey: string }) {
  const storage = getStorage();
  await storage.bucket(input.bucket).file(input.objectKey).delete({ ignoreNotFound: true });
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};
