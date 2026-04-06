import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runRelease } from "../../src/core/release/run-release";

describe("Release Command - Full Flow Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-release-flow-"));
    // Changesets / @manypkg/find-root require a package.json at the project root when .changeset exists
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "release-flow-fixture", version: "0.0.0", private: true }),
      "utf8",
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("release prints hints when no .changeset directory", async () => {
    // No .changeset directory exists
    const result = await runRelease({ projectRoot: tmpDir });
    expect(result).toBeDefined();
    expect(result.hints).toBeDefined();
    expect(result.hints.length).toBeGreaterThan(0);
  }, 30_000);

  it("release runs changesets status when .changeset exists", async () => {
    // Create .changeset directory
    const changesetDir = path.join(tmpDir, ".changeset");
    await fs.mkdir(changesetDir, { recursive: true });
    await fs.writeFile(path.join(changesetDir, "config.json"), JSON.stringify({
      $schema: "https://unpkg.com/@changesets/config@3.0.0/schema.json",
      changelog: "@changesets/cli/changelog",
      commit: false,
      fixed: [],
      linked: [],
      access: "public",
      baseBranch: "main",
      updateInternalDependencies: "patch",
      ignore: [],
    }), "utf8");

    // Note: This will fail if changesets CLI is not installed, but the function should handle it gracefully
    const result = await runRelease({ projectRoot: tmpDir });
    expect(result).toBeDefined();
  }, 30_000);

  it("release detects .changeset directory correctly", async () => {
    const resultNoChangeset = await runRelease({ projectRoot: tmpDir });
    expect(resultNoChangeset.hasChangeset).toBe(false);

    // Create .changeset directory
    const changesetDir = path.join(tmpDir, ".changeset");
    await fs.mkdir(changesetDir, { recursive: true });

    const resultWithChangeset = await runRelease({ projectRoot: tmpDir });
    expect(resultWithChangeset.hasChangeset).toBe(true);
  }, 30_000);

  it("release provides helpful hints when no changeset", async () => {
    const result = await runRelease({ projectRoot: tmpDir });
    expect(result.hints).toBeDefined();
    expect(result.hints.length).toBeGreaterThan(0);
    // Hints should mention changesets
    const hintsText = result.hints.join(" ");
    expect(hintsText.toLowerCase()).toMatch(/changeset|release|version/i);
  }, 30_000);
});
