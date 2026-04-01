import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageSupabaseModule: Module = {
  id: "storage-supabase",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "supabase";

    if (!enabled) {
      if (ctx.modules.storage === false) {
        await backupAndRemove(ctx.projectRoot, "lib/env/storage-supabase.ts");
      }
      await backupAndRemove(ctx.projectRoot, "lib/storage/supabase.ts");
      await backupAndRemove(ctx.projectRoot, "lib/storage/providers/supabase.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage", "providers"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "storage-supabase.ts"),
      `import { z } from "zod";
\nexport const StorageSupabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
});
`
    );

    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "supabase.ts"),
      `import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env/server";
\nexport function getSupabaseAdmin() {
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "providers", "supabase.ts"),
      `import { env } from "@/lib/env/server";
import { getSupabaseAdmin } from "@/lib/storage/supabase";
import type { ProviderSignReadResult, ProviderSignUploadResult } from "@/lib/storage/provider";

export async function providerSignUpload(input: { objectKey: string; contentType: string }): Promise<ProviderSignUploadResult> {
  const supabase = getSupabaseAdmin();
  const bucket = env.SUPABASE_STORAGE_BUCKET!;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(input.objectKey);
  if (error) throw error;
  const token = data.token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = \`Bearer \${token}\`;
  headers["Content-Type"] = input.contentType;
  return { uploadUrl: data.signedUrl, headers };
}

export async function providerSignRead(input: { bucket: string; objectKey: string }): Promise<ProviderSignReadResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(input.bucket).createSignedUrl(input.objectKey, 600);
  if (error) throw error;
  return { url: data.signedUrl };
}

export async function providerDeleteObject(input: { bucket: string; objectKey: string }) {
  const supabase = getSupabaseAdmin();
  await supabase.storage.from(input.bucket).remove([input.objectKey]);
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};
