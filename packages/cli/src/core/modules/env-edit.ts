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
  src = ensureImport(src, `import { StorageEnvSchema } from "./storage";`);

  // Ensure EnvSchema composes optional module schemas.
  if (!src.includes(".and(BillingEnvSchema.partial())")) {
    src = src.replace(
      /export const EnvSchema = z\.object\(\{([\s\S]*?)\}\);\s*/m,
      (m) => m.replace(/\}\);\s*$/m, `}).and(BillingEnvSchema.partial()).and(StorageEnvSchema.partial());\n`)
    );
  }

  await fs.writeFile(p, src, "utf8");
}

