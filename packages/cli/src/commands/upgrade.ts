import type { CAC } from "cac";
import path from "node:path";
import { logger } from "../core/logger";

export function registerUpgradeCommand(cli: CAC) {
  cli
    .command("upgrade", "Upgrade project to latest 0xstack conventions (v1 no-op)")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--apply", "Apply codemods (default: plan only)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      logger.info("Upgrade plan:");
      logger.info(`- dir: ${dir}`);
      logger.info(`- apply: ${options.apply ? "yes" : "no (plan only)"}`);
      logger.info("v1: upgrade is a hook point. No codemods shipped yet.");
      if (options.apply) {
        logger.info("Nothing to apply (v1).");
      }
    });
}

