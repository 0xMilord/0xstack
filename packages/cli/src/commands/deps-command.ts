import type { CAC } from "cac";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { applyProfile, loadConfig } from "../core/config";
import { expectedDepsForConfig } from "../core/deps";
import { logger } from "../core/logger";

export function registerDepsCommand(cli: CAC) {
  cli
    .command("deps", "List expected app dependencies (from config) or CLI package deps")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile preset (default: core)")
    .option("--cli", "Show dependencies of the 0xstack CLI package itself")
    .action(async (options) => {
      if (options.cli) {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const pkgPath = path.join(here, "..", "..", "package.json");
        const raw = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        logger.info("0xstack CLI — dependencies:");
        for (const [k, v] of Object.entries(raw.dependencies ?? {}).sort()) {
          // eslint-disable-next-line no-console
          console.log(`  ${k}@${v}`);
        }
        logger.info("0xstack CLI — devDependencies:");
        for (const [k, v] of Object.entries(raw.devDependencies ?? {}).sort()) {
          // eslint-disable-next-line no-console
          console.log(`  ${k}@${v}`);
        }
        return;
      }

      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      const profile = options.profile ?? "core";
      const cfg = applyProfile(await loadConfig(dir), profile);
      const exp = expectedDepsForConfig(cfg);
      logger.info(`Expected app dependencies (${profile} profile):`);
      for (const d of exp.deps) {
        // eslint-disable-next-line no-console
        console.log(`  ${d}`);
      }
      logger.info("Expected app devDependencies:");
      for (const d of exp.devDeps) {
        // eslint-disable-next-line no-console
        console.log(`  ${d}`);
      }
    });
}
