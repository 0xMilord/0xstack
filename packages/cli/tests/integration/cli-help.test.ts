import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { execa } from "execa";

const pkgRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

describe("CLI Integration Tests (lightweight)", () => {
  it("prints help for --help", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "--help"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0xstack");
  }, 60_000);

  it("prints version for --version", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "--version"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  }, 60_000);

  it("exits zero for unknown command (graceful handling)", async () => {
    const { exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "nonexistent-command"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
  }, 60_000);

  it("config-print outputs valid JSON", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "config-print"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("app");
    expect(parsed).toHaveProperty("modules");
  }, 60_000);

  it("deps command outputs deps array", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "deps"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("better-auth");
    expect(stdout).toContain("drizzle-orm");
  }, 60_000);

  it("modules command lists available modules", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "modules"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("billing");
    expect(stdout).toContain("storage");
    expect(stdout).toContain("seo");
  }, 60_000);

  it("config-validate outputs valid result", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "config-validate"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("valid");
  }, 60_000);

  it("deps --cli outputs CLI dependencies", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "deps", "--cli"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("cac");
    expect(stdout).toContain("chalk");
  }, 60_000);
});
