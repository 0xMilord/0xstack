import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageS3Module: Module = {
  id: "storage-s3",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "s3";
    const routes = [
      "app/api/v1/storage/sign-upload/route.ts",
      "app/api/v1/storage/sign-read/route.ts",
      "app/api/v1/storage/assets/route.ts",
      "app/api/v1/storage/assets/[assetId]/route.ts",
    ];
    if (!enabled) {
      // S3 provider files (do not remove shared assets CQRS/UI which are owned by the selected provider module)
      // Only remove env schema when storage is fully disabled. If another provider is enabled,
      // we keep a stub so lib/env/schema.ts imports always resolve.
      if (ctx.modules.storage === false) {
        await backupAndRemove(ctx.projectRoot, "lib/env/storage-s3.ts");
      }
      await backupAndRemove(ctx.projectRoot, "lib/storage/s3.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "storage-s3.ts"),
      `import { z } from "zod";
\nexport const StorageS3EnvSchema = z.object({
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  // Optional: S3-compatible endpoint (MinIO/R2/etc). If set, requests use path-style.
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

    // The shared storage CQRS + routes + UI are currently emitted by the GCS module.
    // In the next implementation pass, we refactor them into provider-agnostic + provider files.
    // For now, S3 module only ensures env + client exist so the refactor can land cleanly.
    for (const r of routes) await ensureDir(path.join(ctx.projectRoot, ...path.dirname(r).split("/")));
  },
  validate: async () => {},
  sync: async () => {},
};

