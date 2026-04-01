import type { CAC } from "cac";
import path from "node:path";
import { runRelease } from "../core/release/run-release";

export function registerReleaseCommand(cli: CAC) {
  cli
    .command("release", "Changesets status / release hints (shells out when .changeset exists)")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      await runRelease({ projectRoot: dir });
    });
}

