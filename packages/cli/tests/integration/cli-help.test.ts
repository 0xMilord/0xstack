import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { execa } from "execa";

const pkgRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

describe("CLI (integration)", () => {
  it("prints help for --help", async () => {
    const { stdout, exitCode } = await execa("pnpm", ["exec", "tsx", path.join(pkgRoot, "src/index.ts"), "--help"], {
      cwd: pkgRoot,
      stdio: "pipe",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0xstack");
  }, 60_000);
});
