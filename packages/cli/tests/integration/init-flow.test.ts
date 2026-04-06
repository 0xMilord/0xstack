import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runInit } from "../../src/core/init/run-init";

describe("Init Command - Full Flow Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-init-flow-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("init rejects non-empty directory", async () => {
    await fs.writeFile(path.join(tmpDir, "existing.txt"), "hello", "utf8");
    await expect(runInit({
      dir: tmpDir,
      name: "TestApp",
      description: "A test app",
      packageManager: "pnpm",
      theme: "default",
      features: {
        seo: false,
        blogMdx: false,
        billing: false,
        storage: false,
        email: false,
        cache: true,
        pwa: false,
        jobs: { enabled: false, driver: "cron-only" },
        observability: { sentry: false },
      },
    })).rejects.toThrow("not empty");
  }, 30_000);

  it("init rejects directory name starting with dot", async () => {
    const target = path.join(tmpDir, ".hidden");
    await expect(runInit({
      dir: target,
      name: "TestApp",
      description: "A test app",
      packageManager: "pnpm",
      theme: "default",
      features: {
        seo: false,
        blogMdx: false,
        billing: false,
        storage: false,
        email: false,
        cache: true,
        pwa: false,
        jobs: { enabled: false, driver: "cron-only" },
        observability: { sentry: false },
      },
    })).rejects.toThrow("Invalid project directory name");
  }, 30_000);

  it("init rejects directory name starting with underscore", async () => {
    const target = path.join(tmpDir, "_hidden");
    await expect(runInit({
      dir: target,
      name: "TestApp",
      description: "A test app",
      packageManager: "pnpm",
      theme: "default",
      features: {
        seo: false,
        blogMdx: false,
        billing: false,
        storage: false,
        email: false,
        cache: true,
        pwa: false,
        jobs: { enabled: false, driver: "cron-only" },
        observability: { sentry: false },
      },
    })).rejects.toThrow("Invalid project directory name");
  }, 30_000);
});
