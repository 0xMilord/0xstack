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
      await backupAndRemove(ctx.projectRoot, "lib/env/storage-supabase.ts");
      await backupAndRemove(ctx.projectRoot, "lib/storage/supabase.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));

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
  },
  validate: async () => {},
  sync: async () => {},
};

