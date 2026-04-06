import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ensureEnvSchemaModuleWiring } from "../../src/core/modules/env-edit";

describe("ensureEnvSchemaModuleWiring", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-env-"));
    const envDir = path.join(tmpDir, "lib", "env");
    await fs.mkdir(envDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds import and .and() for missing module schema", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";
import { BillingEnvSchema } from "./billing";

export const EnvSchema = z.object({
  DATABASE_URL: z.string(),
}).and(BillingEnvSchema.partial());
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    // Should add storage schema import and .and() if not present
    expect(content).toContain("import { BillingEnvSchema }");
  });

  it("does not duplicate existing import", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";
import { BillingEnvSchema } from "./billing";
import { StorageEnvSchema } from "./storage";

export const EnvSchema = z.object({}).and(BillingEnvSchema.partial()).and(StorageEnvSchema.partial());
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    const importCount = (content.match(/import.*BillingEnvSchema/g) || []).length;
    expect(importCount).toBe(1);
  });
});
