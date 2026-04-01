import type { CAC } from "cac";
import path from "node:path";
import { runSync } from "../core/sync/run-sync";

export function registerSyncCommand(cli: CAC) {
  cli
    .command("sync", "Reconcile repo with 0xstack.config (plan by default)")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile preset to apply (default: core)")
    .option("--apply", "Apply changes (default: plan only)")
    .option("--pm <pm>", "Package manager when applying baseline: pnpm|npm (default: pnpm)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      const profile = options.profile ?? "core";
      const pm = options.pm === "npm" ? "npm" : "pnpm";
      await runSync({ projectRoot: dir, profile, apply: !!options.apply, packageManager: pm });
    });
}

