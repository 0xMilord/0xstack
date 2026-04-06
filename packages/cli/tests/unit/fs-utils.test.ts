import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exists, ensureDir, writeFileEnsured, backupAndRemove } from "../../src/core/modules/fs-utils";

describe("exists", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-fs-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns true for existing file", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    await fs.writeFile(filePath, "hello", "utf8");
    expect(await exists(filePath)).toBe(true);
  });

  it("returns false for missing file", async () => {
    expect(await exists(path.join(tmpDir, "nonexistent.txt"))).toBe(false);
  });

  it("returns true for existing directory", async () => {
    const dirPath = path.join(tmpDir, "subdir");
    await fs.mkdir(dirPath, { recursive: true });
    expect(await exists(dirPath)).toBe(true);
  });
});

describe("ensureDir", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-fs-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates nested directories", async () => {
    const dirPath = path.join(tmpDir, "a", "b", "c");
    await ensureDir(dirPath);
    expect(await exists(dirPath)).toBe(true);
  });

  it("does not throw if directory already exists", async () => {
    const dirPath = path.join(tmpDir, "existing");
    await fs.mkdir(dirPath, { recursive: true });
    await expect(ensureDir(dirPath)).resolves.not.toThrow();
  });
});

describe("writeFileEnsured", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-fs-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes file content", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    await writeFileEnsured(filePath, "hello world");
    const content = await fs.readFile(filePath, "utf8");
    expect(content).toBe("hello world");
  });

  it("creates parent directories", async () => {
    const filePath = path.join(tmpDir, "nested", "deep", "test.txt");
    await writeFileEnsured(filePath, "nested content");
    expect(await exists(filePath)).toBe(true);
    const content = await fs.readFile(filePath, "utf8");
    expect(content).toBe("nested content");
  });

  it("overwrites existing file", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    await fs.writeFile(filePath, "old content", "utf8");
    await writeFileEnsured(filePath, "new content");
    const content = await fs.readFile(filePath, "utf8");
    expect(content).toBe("new content");
  });
});

describe("backupAndRemove", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-fs-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("moves file to .0xstack/disabled/", async () => {
    const filePath = path.join(tmpDir, "old-file.ts");
    await fs.writeFile(filePath, "old content", "utf8");
    await backupAndRemove(tmpDir, "old-file.ts");
    expect(await exists(filePath)).toBe(false);
    const backupPath = path.join(tmpDir, ".0xstack", "disabled", "old-file.ts");
    expect(await exists(backupPath)).toBe(true);
    const content = await fs.readFile(backupPath, "utf8");
    expect(content).toBe("old content");
  });

  it("handles missing file gracefully", async () => {
    await expect(backupAndRemove(tmpDir, "nonexistent.ts")).resolves.not.toThrow();
  });

  it("handles nested path", async () => {
    const nestedDir = path.join(tmpDir, "app", "api");
    await fs.mkdir(nestedDir, { recursive: true });
    const filePath = path.join(nestedDir, "route.ts");
    await fs.writeFile(filePath, "route content", "utf8");
    await backupAndRemove(tmpDir, "app/api/route.ts");
    expect(await exists(filePath)).toBe(false);
    const backupPath = path.join(tmpDir, ".0xstack", "disabled", "app", "api", "route.ts");
    expect(await exists(backupPath)).toBe(true);
  });
});
