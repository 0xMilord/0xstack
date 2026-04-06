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

  it("adds BillingEnvSchema import and .and() when missing", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";

export const EnvSchema = z.object({
  DATABASE_URL: z.string(),
});
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    expect(content).toContain("import { BillingEnvSchema }");
    expect(content).toContain("BillingEnvSchema.partial()");
  });

  it("adds StorageEnvSchema import and .and() when missing", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";
import { BillingEnvSchema } from "./billing";

export const EnvSchema = z.object({}).and(BillingEnvSchema.partial());
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    expect(content).toContain("import { StorageEnvSchema }");
    expect(content).toContain("StorageEnvSchema.partial()");
  });

  it("does not duplicate existing BillingEnvSchema import", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";
import { BillingEnvSchema } from "./billing";

export const EnvSchema = z.object({}).and(BillingEnvSchema.partial());
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    const importCount = (content.match(/import.*BillingEnvSchema/g) || []).length;
    expect(importCount).toBe(1);
  });

  it("does not duplicate existing StorageEnvSchema import", async () => {
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
    const billingImportCount = (content.match(/import.*BillingEnvSchema/g) || []).length;
    const storageImportCount = (content.match(/import.*StorageEnvSchema/g) || []).length;
    expect(billingImportCount).toBe(1);
    expect(storageImportCount).toBe(1);
  });

  it("handles schema with no .and() calls yet", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";

export const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
});
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    expect(content).toContain("BillingEnvSchema");
    expect(content).toContain("StorageEnvSchema");
  });

  it("is idempotent (running twice produces same result)", async () => {
    await fs.writeFile(
      path.join(tmpDir, "lib", "env", "schema.ts"),
      `import { z } from "zod";

export const EnvSchema = z.object({
  DATABASE_URL: z.string(),
});
`,
      "utf8"
    );
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content1 = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    await ensureEnvSchemaModuleWiring(tmpDir);
    const content2 = await fs.readFile(path.join(tmpDir, "lib", "env", "schema.ts"), "utf8");
    expect(content1).toBe(content2);
  });
});
