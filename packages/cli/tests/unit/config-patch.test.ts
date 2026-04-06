import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { patchConfigModules, ensureObservabilityAndJobsKeys } from "../../src/core/config-patch";

describe("patchConfigModules", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-patch-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("updates existing key from false to true", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(
      configPath,
      `export default {
  modules: {
    orgs: true,
    billing: false,
    storage: false,
    email: false,
    cache: true,
    pwa: false,
    seo: false,
    blogMdx: false,
  },
};
`,
      "utf8"
    );
    await patchConfigModules(tmpDir, { seo: true });
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toContain("seo: true");
    expect(content).not.toContain("seo: false");
  });

  it("updates existing key", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(
      configPath,
      `export default {
  modules: {
    orgs: true,
    billing: false,
    pwa: false,
  },
};
`,
      "utf8"
    );
    await patchConfigModules(tmpDir, { pwa: true });
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toContain("pwa: true");
    expect(content).not.toContain("pwa: false");
  });

  it("handles string values", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(
      configPath,
      `export default {
  modules: {
    orgs: true,
    billing: false,
  },
};
`,
      "utf8"
    );
    await patchConfigModules(tmpDir, { billing: "stripe" as any });
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toContain('billing: "stripe"');
  });

  it("handles boolean false values", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(
      configPath,
      `export default {
  modules: {
    orgs: true,
    billing: "dodo",
  },
};
`,
      "utf8"
    );
    await patchConfigModules(tmpDir, { billing: false });
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toContain("billing: false");
  });
});

describe("ensureObservabilityAndJobsKeys", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-obs-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // Note: ensureObservabilityAndJobsKeys uses regex that may not match Windows \r\n line endings.
  // The function is tested indirectly through baseline integration tests.

  it("adds missing jobs key", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(
      configPath,
      `export default {
  modules: {
    orgs: true,
    billing: false,
    storage: false,
    email: false,
    cache: true,
    pwa: false,
    seo: false,
    blogMdx: false,
    observability: { sentry: false },
  },
};
`,
      "utf8"
    );
    await ensureObservabilityAndJobsKeys(tmpDir);
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toContain("jobs:");
    expect(content).toContain("enabled: false");
    expect(content).toContain("driver:");
  });

  it("does not modify config that already has keys", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    const original = `export default {
  modules: {
    orgs: true,
    billing: false,
    storage: false,
    email: false,
    cache: true,
    pwa: false,
    seo: false,
    blogMdx: false,
    observability: { sentry: false },
    jobs: { enabled: false, driver: "cron-only" },
  },
};
`;
    await fs.writeFile(configPath, original, "utf8");
    await ensureObservabilityAndJobsKeys(tmpDir);
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toBe(original);
  });
});
