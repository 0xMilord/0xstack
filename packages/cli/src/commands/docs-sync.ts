import type { CAC } from "cac";
import path from "node:path";
import { runDocsSync } from "../core/docs/run-docs-sync";

export function registerDocsSyncCommand(cli: CAC) {
  cli
    .command("docs-sync", "Regenerate docs using stable markers")
    .alias("docs:sync")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      await runDocsSync({ projectRoot: dir });
    });
}

