import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ConfigSchema, applyProfile, loadConfig, writeDefaultConfig } from "../../src/core/config";

describe("ConfigSchema", () => {
  it("parses empty config with defaults", () => {
    const cfg = ConfigSchema.parse({});
    expect(cfg.app.name).toBe("MyApp");
    expect(cfg.app.baseUrl).toBe("http://localhost:3000");
    expect(cfg.app.envMode).toBe("strict");
    expect(cfg.modules.auth).toBe("better-auth");
    expect(cfg.modules.orgs).toBe(true);
    expect(cfg.modules.billing).toBe(false);
    expect(cfg.modules.storage).toBe(false);
    expect(cfg.modules.email).toBe(false);
    expect(cfg.modules.cache).toBe(true);
    expect(cfg.modules.pwa).toBe(false);
    expect(cfg.modules.seo).toBe(false);
    expect(cfg.modules.blogMdx).toBe(false);
    expect(cfg.modules.observability).toEqual({ sentry: false, otel: false });
    expect(cfg.modules.jobs).toEqual({ enabled: false, driver: "cron-only" });
  });

  it("rejects invalid module values", () => {
    expect(() => ConfigSchema.parse({ modules: { billing: "invalid" } })).toThrow();
    expect(() => ConfigSchema.parse({ modules: { storage: "azure" } })).toThrow();
    expect(() => ConfigSchema.parse({ modules: { email: "sendgrid" } })).toThrow();
    expect(() => ConfigSchema.parse({ modules: { auth: "next-auth" } })).toThrow();
    expect(() => ConfigSchema.parse({ app: { envMode: "loose" } })).toThrow();
  });

  it("accepts full profile config", () => {
    const cfg = ConfigSchema.parse({
      app: { name: "TestApp", description: "Test", baseUrl: "https://test.com" },
      modules: {
        orgs: true,
        billing: "stripe",
        storage: "s3",
        email: "resend",
        cache: true,
        pwa: true,
        seo: true,
        blogMdx: true,
        observability: { sentry: true, otel: true },
        jobs: { enabled: true, driver: "inngest" },
      },
      profiles: {
        production: {
          modules: { billing: "stripe", seo: true },
        },
      },
    });
    expect(cfg.modules.billing).toBe("stripe");
    expect(cfg.modules.storage).toBe("s3");
    expect(cfg.modules.observability.sentry).toBe(true);
    expect(cfg.modules.jobs.driver).toBe("inngest");
  });
});

describe("applyProfile", () => {
  it("returns the same config when profile is missing", () => {
    const cfg = ConfigSchema.parse({});
    expect(applyProfile(cfg, "full")).toEqual(cfg);
  });

  it("merges profile module patch into modules", () => {
    const cfg = ConfigSchema.parse({
      profiles: {
        full: {
          modules: {
            seo: true,
            blogMdx: true,
            billing: "dodo",
          },
        },
      },
    });
    const next = applyProfile(cfg, "full");
    expect(next.modules.seo).toBe(true);
    expect(next.modules.blogMdx).toBe(true);
    expect(next.modules.billing).toBe("dodo");
  });

  it("deep-merges observability and jobs", () => {
    const cfg = ConfigSchema.parse({
      modules: {
        observability: { sentry: false, otel: true },
        jobs: { enabled: false, driver: "cron-only" },
      },
      profiles: {
        staging: {
          modules: {
            observability: { sentry: true },
            jobs: { enabled: true, driver: "inngest" },
          },
        },
      },
    });
    const next = applyProfile(cfg, "staging");
    expect(next.modules.observability).toEqual({ sentry: true, otel: true });
    expect(next.modules.jobs).toEqual({ enabled: true, driver: "inngest" });
  });
});

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-config-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file", async () => {
    const cfg = await loadConfig(tmpDir);
    expect(cfg.app.name).toBe("MyApp");
    expect(cfg.modules.auth).toBe("better-auth");
  });

  it("parses .ts config via jiti", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(
      configPath,
      `import { defineConfig } from "./lib/0xstack/config";
export default defineConfig({
  app: { name: "JitiTest", baseUrl: "http://localhost:3000" },
  modules: { orgs: true, billing: false, storage: false, email: false, cache: true, pwa: false, seo: false, blogMdx: false, observability: { sentry: false, otel: false }, jobs: { enabled: false, driver: "cron-only" } },
});
`,
      "utf8"
    );
    // Also need the config module file for defineConfig
    const libDir = path.join(tmpDir, "lib", "0xstack");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(
      path.join(libDir, "config.ts"),
      `import { z } from "zod";
const ConfigSchema = z.object({
  app: z.object({ name: z.string(), description: z.string().optional(), baseUrl: z.string().url() }),
  modules: z.object({
    auth: z.literal("better-auth").optional(),
    orgs: z.boolean(),
    billing: z.union([z.literal(false), z.literal("dodo"), z.literal("stripe")]),
    storage: z.union([z.literal(false), z.literal("gcs"), z.literal("s3"), z.literal("supabase")]),
    email: z.union([z.literal(false), z.literal("resend")]),
    cache: z.boolean().optional(),
    pwa: z.boolean().optional(),
    seo: z.boolean(),
    blogMdx: z.boolean(),
    observability: z.object({ sentry: z.boolean(), otel: z.boolean() }).optional(),
    jobs: z.object({ enabled: z.boolean(), driver: z.enum(["inngest", "cron-only"]) }).optional(),
  }),
  profiles: z.record(z.string(), z.any()).optional(),
});
export function defineConfig(config) { return ConfigSchema.parse(config); }
`,
      "utf8"
    );
    const cfg = await loadConfig(tmpDir);
    expect(cfg.app.name).toBe("JitiTest");
  });
});

describe("writeDefaultConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-write-config-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates file with correct content", async () => {
    await writeDefaultConfig(tmpDir, "TestApp", "A test app", {
      seo: true,
      blogMdx: false,
      billing: "dodo",
      storage: "gcs",
      email: "resend",
      cache: true,
      pwa: false,
      jobs: { enabled: false, driver: "cron-only" },
      observability: { sentry: false, otel: false },
    });
    const content = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(content).toContain("TestApp");
    expect(content).toContain("A test app");
    expect(content).toContain('"dodo"');
    expect(content).toContain('"gcs"');
    expect(content).toContain('"resend"');
  });

  it("skips if file exists", async () => {
    const configPath = path.join(tmpDir, "0xstack.config.ts");
    await fs.writeFile(configPath, "// existing", "utf8");
    await writeDefaultConfig(tmpDir, "TestApp", "A test app");
    const content = await fs.readFile(configPath, "utf8");
    expect(content).toBe("// existing");
  });

  it("includes all module flags", async () => {
    await writeDefaultConfig(tmpDir, "TestApp", "A test app");
    const content = await fs.readFile(path.join(tmpDir, "0xstack.config.ts"), "utf8");
    expect(content).toContain("billing:");
    expect(content).toContain("storage:");
    expect(content).toContain("email:");
    expect(content).toContain("cache:");
    expect(content).toContain("pwa:");
    expect(content).toContain("seo:");
    expect(content).toContain("blogMdx:");
    expect(content).toContain("observability:");
    expect(content).toContain("jobs:");
  });
});
