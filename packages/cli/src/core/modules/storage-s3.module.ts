import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageS3Module: Module = {
  id: "storage-s3",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "s3";

    if (!enabled) {
      if (ctx.modules.storage === false) {
        await backupAndRemove(ctx.projectRoot, "lib/env/storage-s3.ts");
      }
      await backupAndRemove(ctx.projectRoot, "lib/storage/s3.ts");
      await backupAndRemove(ctx.projectRoot, "lib/storage/providers/s3.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage", "providers"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "storage-s3.ts"),
      `import { z } from "zod";
\nexport const StorageS3EnvSchema = z.object({
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_ENDPOINT: z.string().url().optional(),
});
`
    );

    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "s3.ts"),
      `import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env/server";
\nexport function getS3() {
  return new S3Client({
    region: env.S3_REGION!,
    endpoint: env.AWS_ENDPOINT || undefined,
    forcePathStyle: Boolean(env.AWS_ENDPOINT),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "providers", "s3.ts"),
      `import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env/server";
import { getS3 } from "@/lib/storage/s3";
import type { ProviderSignReadResult, ProviderSignUploadResult } from "@/lib/storage/provider";

export async function providerSignUpload(input: { objectKey: string; contentType: string }): Promise<ProviderSignUploadResult> {
  const s3 = getS3();
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET!,
    Key: input.objectKey,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
  return { uploadUrl, headers: { "Content-Type": input.contentType } };
}

export async function providerSignRead(input: { bucket: string; objectKey: string }): Promise<ProviderSignReadResult> {
  const s3 = getS3();
  const cmd = new GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });
  return { url };
}

export async function providerDeleteObject(input: { bucket: string; objectKey: string }) {
  const s3 = getS3();
  await s3.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};
