import type { CAC } from "cac";
import path from "node:path";
import { execCmd } from "../core/exec";
import { logger } from "../core/logger";

export function registerGitCommands(cli: CAC) {
  cli
    .command("git init", "Initialize git repo")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options: any) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      logger.info(`Running: git init (cwd=${dir})`);
      await execCmd("git", ["init"], { cwd: dir });
      logger.info("Done.");
    });

  cli
    .command("git status", "Show git status")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options: any) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      logger.info(`Running: git status (cwd=${dir})`);
      await execCmd("git", ["status"], { cwd: dir });
    });
}

