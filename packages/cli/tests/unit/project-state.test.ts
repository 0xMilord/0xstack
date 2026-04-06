import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { computeProjectState } from "../../src/core/project/project-state";

describe("computeProjectState", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-state-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns default state when no config file", async () => {
    const state = await computeProjectState(tmpDir, "core");
    expect(state).toHaveProperty("config");
    expect(state).toHaveProperty("modules");
    expect(state.modules.auth).toBe("better-auth");
    expect(state.modules.orgs).toBe(true);
  });

  it("applies profile to modules", async () => {
    // Write a config with a full profile
    await fs.writeFile(
      path.join(tmpDir, "0xstack.config.ts"),
      `import { defineConfig } from "./lib/0xstack/config";
export default defineConfig({
  app: { name: "TestApp", baseUrl: "http://localhost:3000" },
  modules: { orgs: true, billing: false, storage: false, email: false, cache: true, pwa: false, seo: false, blogMdx: false, observability: { sentry: false, otel: false }, jobs: { enabled: false, driver: "cron-only" } },
  profiles: {
    full: { modules: { seo: true, blogMdx: true, billing: "dodo" } },
  },
});
`,
      "utf8"
    );
    // Also need the config runtime module
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
    const state = await computeProjectState(tmpDir, "full");
    expect(state.modules.seo).toBe(true);
    expect(state.modules.blogMdx).toBe(true);
    expect(state.modules.billing).toBe("dodo");
  });
});
