import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { computeProjectState } from "../../src/core/project/project-state";

describe("computeProjectState", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-state-"));
    // computeProjectState requires app/ directory
    await fs.mkdir(path.join(tmpDir, "app"), { recursive: true });
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

  // Note: Testing profile application via jiti requires zod installed in temp dir.
  // This is tested indirectly through integration tests that run baseline.
});
