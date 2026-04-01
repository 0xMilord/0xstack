import fs from "node:fs/promises";
import path from "node:path";

function ensureImport(src: string, importLine: string) {
  if (src.includes(importLine)) return src;
  const lines = src.split("\n");
  const zodIdx = lines.findIndex((l) => l.includes('from "zod"'));
  const insertAt = zodIdx === -1 ? 0 : zodIdx + 1;
  lines.splice(insertAt, 0, importLine);
  return lines.join("\n");
}

export async function ensureEnvSchemaModuleWiring(projectRoot: string) {
  const p = path.join(projectRoot, "lib", "env", "schema.ts");
  let src = await fs.readFile(p, "utf8");

  src = ensureImport(src, `import { BillingEnvSchema } from "./billing";`);
  src = ensureImport(src, `import { BillingStripeEnvSchema } from "./billing-stripe";`);
  src = ensureImport(src, `import { StorageEnvSchema } from "./storage";`);
  src = ensureImport(src, `import { StorageS3EnvSchema } from "./storage-s3";`);
  src = ensureImport(src, `import { StorageSupabaseEnvSchema } from "./storage-supabase";`);
  src = ensureImport(src, `import { EmailEnvSchema } from "./email";`);
  src = ensureImport(src, `import { PwaEnvSchema } from "./pwa";`);
  src = ensureImport(src, `import { ObservabilityEnvSchema } from "./observability";`);

  // Ensure EnvSchema composes optional module schemas (idempotent).
  const needsCompose =
    !src.includes(".and(BillingEnvSchema.partial())") ||
    !src.includes(".and(BillingStripeEnvSchema.partial())") ||
    !src.includes(".and(StorageEnvSchema.partial())") ||
    !src.includes(".and(StorageS3EnvSchema.partial())") ||
    !src.includes(".and(StorageSupabaseEnvSchema.partial())") ||
    !src.includes(".and(EmailEnvSchema.partial())") ||
    !src.includes(".and(PwaEnvSchema.partial())") ||
    !src.includes(".and(ObservabilityEnvSchema.partial())");
  if (needsCompose) {
    src = src
      // normalize any existing one-line chain
      .replace(
        /\}\)\.and\(BillingEnvSchema\.partial\(\)\)(?:\.and\(BillingStripeEnvSchema\.partial\(\)\))?(?:\.and\(StorageEnvSchema\.partial\(\)\))?(?:\.and\(StorageS3EnvSchema\.partial\(\)\))?(?:\.and\(StorageSupabaseEnvSchema\.partial\(\)\))?(?:\.and\(EmailEnvSchema\.partial\(\)\))?(?:\.and\(PwaEnvSchema\.partial\(\)\))?(?:\.and\(ObservabilityEnvSchema\.partial\(\)\))?;\s*$/m,
        `})
  .and(BillingEnvSchema.partial())
  .and(BillingStripeEnvSchema.partial())
  .and(StorageEnvSchema.partial())
  .and(StorageS3EnvSchema.partial())
  .and(StorageSupabaseEnvSchema.partial())
  .and(EmailEnvSchema.partial())
  .and(PwaEnvSchema.partial())
  .and(ObservabilityEnvSchema.partial());`
      )
      // if there was no chain at all yet, add it
      .replace(
        /export const EnvSchema = z\.object\(\{([\s\S]*?)\}\);\s*/m,
        (m) =>
          m.replace(
            /\}\);\s*$/m,
            `})
  .and(BillingEnvSchema.partial())
  .and(BillingStripeEnvSchema.partial())
  .and(StorageEnvSchema.partial())
  .and(StorageS3EnvSchema.partial())
  .and(StorageSupabaseEnvSchema.partial())
  .and(EmailEnvSchema.partial())
  .and(PwaEnvSchema.partial())
  .and(ObservabilityEnvSchema.partial());\n`
          )
      );
  }

  await fs.writeFile(p, src, "utf8");
}

