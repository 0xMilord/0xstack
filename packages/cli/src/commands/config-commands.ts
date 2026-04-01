import type { CAC } from "cac";
import path from "node:path";
import { applyProfile, ConfigSchema, loadConfig } from "../core/config";
import { logger } from "../core/logger";

export function registerConfigCommands(cli: CAC) {
  cli
    .command("config-print", "Print resolved 0xstack config (JSON) after profile merge")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile preset (default: core)")
    .action(async (options: { dir?: string; profile?: string }) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      const profile = options.profile ?? "core";
      const raw = await loadConfig(dir);
      const merged = applyProfile(raw, profile);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(merged, null, 2));
    });

  cli
    .command("config-validate", "Validate 0xstack.config.ts against the schema")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options: { dir?: string }) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      try {
        const raw = await loadConfig(dir);
        ConfigSchema.parse(raw);
        logger.success("Config is valid.");
      } catch (e) {
        logger.error(`Invalid config: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }
    });
}
