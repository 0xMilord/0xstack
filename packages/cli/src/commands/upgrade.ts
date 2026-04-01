import type { CAC } from "cac";
import path from "node:path";
import { runUpgrade } from "../core/upgrade/run-upgrade";

export function registerUpgradeCommand(cli: CAC) {
  cli
    .command("upgrade", "Refresh PRD hygiene (config/schema/ESLint factories/vitest); future: codemods")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--apply", "Apply updates (default: plan only)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      await runUpgrade({ projectRoot: dir, apply: !!options.apply });
    });
}

