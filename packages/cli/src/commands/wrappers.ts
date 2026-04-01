import type { CAC } from "cac";
import path from "node:path";
import { diffSnapshots, execCmd, snapshotFiles } from "../core/exec";
import { logger } from "../core/logger";
import { detectPackageManager, pmDlx, pmExec } from "../core/pm";

type WrapperId = "shadcn" | "auth" | "drizzle";

function registerWrapper(cli: CAC, id: WrapperId) {
  cli
    .command(`${id} [...args]`, `Pass through to ${id} CLI`)
    .action(async (args: string[] = []) => {
      const cwd = process.cwd();
      const pm = await detectPackageManager(cwd);
      const before = await snapshotFiles(cwd);

      if (id === "shadcn") {
        const { cmd, dlxArgs } = pmDlx(pm);
        const fullArgs = [...dlxArgs, "shadcn@latest", ...args];
        logger.info(`Running: ${cmd} ${fullArgs.join(" ")}`);
        await execCmd(cmd, fullArgs, { cwd });
        const after = await snapshotFiles(cwd);
        const diff = diffSnapshots(before, after);
        logger.info(`Modified files: added=${diff.added.length} changed=${diff.changed.length} removed=${diff.removed.length}`);
        return;
      }

      if (id === "auth") {
        // Better Auth CLI. PRD expects `npx auth@latest generate` support.
        const { cmd, dlxArgs } = pmDlx(pm);
        const fullArgs = [...dlxArgs, "auth@latest", ...args];
        logger.info(`Running: ${cmd} ${fullArgs.join(" ")}`);
        await execCmd(cmd, fullArgs, { cwd });
        const after = await snapshotFiles(cwd);
        const diff = diffSnapshots(before, after);
        logger.info(`Modified files: added=${diff.added.length} changed=${diff.changed.length} removed=${diff.removed.length}`);
        return;
      }

      // drizzle-kit should be installed in the target repo; use package-manager exec.
      const { cmd, execArgs } = pmExec(pm);
      const fullArgs = [...execArgs, "drizzle-kit", ...args];
      logger.info(`Running: ${cmd} ${fullArgs.join(" ")}`);
      await execCmd(cmd, fullArgs, { cwd });
      const after = await snapshotFiles(cwd);
      const diff = diffSnapshots(before, after);
      logger.info(`Modified files: added=${diff.added.length} changed=${diff.changed.length} removed=${diff.removed.length}`);
    });
}

export function registerWrapperCommands(cli: CAC) {
  // Namespaces required by PRD wrapper policy
  registerWrapper(cli, "shadcn");
  registerWrapper(cli, "auth");
  registerWrapper(cli, "drizzle");

  // Convenience alias: `0xstack drizzle ...` is already covered above.
  // Keep commands flat and explicit (no nested subcommands needed).
  cli.command("wrap", "Show wrapper commands and audit hints").action(() => {
    const cwd = process.cwd();
    logger.info(`Wrappers run in cwd: ${cwd}`);
    logger.info("");
    logger.info("Passthrough commands (each logs the underlying command + file diff):");
    logger.info("  0xstack shadcn [...args]   — shadcn@latest");
    logger.info("  0xstack auth [...args]      — auth@latest (Better Auth CLI)");
    logger.info("  0xstack drizzle [...args]  — drizzle-kit via package manager");
    logger.info("");
    logger.info("Operator helpers:");
    logger.info("  0xstack wizard            — TUI to reconfigure modules (existing repo)");
    logger.info("  0xstack config-print      — resolved config JSON");
    logger.info("  0xstack config-validate   — Zod check");
    logger.info("  0xstack deps              — expected app deps from config");
    logger.info("  0xstack deps --cli        — this CLI's package.json deps");
    logger.info("  0xstack modules           — ids for `0xstack add`");
  });
}

