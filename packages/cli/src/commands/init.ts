import type { CAC } from "cac";
import path from "node:path";
import { runInit } from "../core/init/run-init";
import { promptInitDefaults } from "../core/interactive/prompt-init";

export function registerInitCommand(cli: CAC) {
  cli
    .command("init", "Initialize a new 0xstack app")
    .option("--dir <dir>", "Target directory (default: current)")
    .option("--name <name>", "Project name (default: folder name)")
    .option("--pm <pm>", "Package manager: pnpm|npm (default: pnpm)")
    .option("--theme <theme>", "Theme: default|corporate-blue|amber|grass (default: default)")
    .option("--yes", "Skip prompts (CI-friendly)")
    .option("--interactive", "Force prompts even in non-TTY")
    .action(async (options) => {
      const cwd = process.cwd();
      const pm = options.pm ?? "pnpm";

      const shouldPrompt =
        !options.yes && (options.interactive || process.stdout.isTTY) && !options.dir && !options.name;
      if (shouldPrompt) {
        const answers = await promptInitDefaults(cwd);
        await runInit({
          dir: answers.dir,
          name: answers.name,
          packageManager: answers.packageManager,
          theme: answers.theme,
          features: answers.modules,
        });
        return;
      }

      const dir = path.resolve(cwd, options.dir ?? ".");
      const name = options.name ?? path.basename(dir);
      await runInit({
        dir,
        name,
        packageManager: pm === "npm" ? "npm" : "pnpm",
        theme:
          options.theme === "corporate-blue" || options.theme === "amber" || options.theme === "grass"
            ? options.theme
            : "default",
      });
    });
}

