import type { CAC } from "cac";
import path from "node:path";
import { runAddModule } from "../core/add/run-add-module";

export function registerAddCommand(cli: CAC) {
  cli
    .command("add <module>", "Enable a module in config and apply baseline (see `0xstack modules`)")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (moduleId: string, options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      await runAddModule({ projectRoot: dir, moduleId });
    });
}

