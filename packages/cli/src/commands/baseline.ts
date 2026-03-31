import type { CAC } from "cac";
import path from "node:path";
import { runBaseline } from "../core/baseline/run-baseline";

export function registerBaselineCommand(cli: CAC) {
  cli
    .command("baseline", "Install and activate baseline modules (idempotent)")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile preset: core|full (default: core)")
    .option("--pm <pm>", "Package manager: pnpm|npm (default: pnpm)")
    .action(async (options) => {
      const cwd = process.cwd();
      const dir = path.resolve(cwd, options.dir ?? ".");
      const profile = options.profile ?? "core";
      const pm = options.pm ?? "pnpm";

      await runBaseline({
        projectRoot: dir,
        profile,
        packageManager: pm === "npm" ? "npm" : "pnpm",
      });
    });
}

