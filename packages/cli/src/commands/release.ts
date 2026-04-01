import type { CAC } from "cac";
import path from "node:path";
import { logger } from "../core/logger";

export function registerReleaseCommand(cli: CAC) {
  cli
    .command("release", "Release automation (v1 stub)")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      logger.info("Release plan:");
      logger.info(`- dir: ${dir}`);
      logger.info("v1: release is a stub. Recommended: changesets for monorepos.");
      logger.info("Next steps: add changesets, generate changelog, tag + push in CI.");
    });
}

