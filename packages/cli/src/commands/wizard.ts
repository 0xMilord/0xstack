import type { CAC } from "cac";
import path from "node:path";
import fs from "node:fs/promises";
import prompts from "prompts";
import { applyProfile, loadConfig } from "../core/config";
import { patchConfigModules, ensureObservabilityAndJobsKeys } from "../core/config-patch";
import { runProgressiveReconfigureWizard } from "../core/interactive/setup-wizard";
import { runBaseline } from "../core/baseline/run-baseline";
import { logger } from "../core/logger";

export function registerWizardCommand(cli: CAC) {
  cli
    .command("wizard", "Progressive TUI: reconfigure modules in an existing project")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile preset for baseline (default: core)")
    .option("--pm <pm>", "Package manager for baseline: pnpm|npm (default: pnpm)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      const profile = options.profile ?? "core";
      const pm = options.pm === "npm" ? "npm" : "pnpm";

      const cfgPath = path.join(dir, "0xstack.config.ts");
      try {
        await fs.access(cfgPath);
      } catch {
        logger.error(`No 0xstack.config.ts in ${dir}. Run \`0xstack init\` first.`);
        process.exit(1);
      }

      await ensureObservabilityAndJobsKeys(dir);
      const cfg = applyProfile(await loadConfig(dir), profile);
      const m = cfg.modules;

      const next = await runProgressiveReconfigureWizard({
        billing: m.billing,
        storage: m.storage,
        seo: m.seo,
        blogMdx: m.blogMdx,
        email: m.email,
        cache: m.cache,
        pwa: m.pwa,
        jobs: m.jobs,
        observability: m.observability,
      });

      await patchConfigModules(dir, {
        billing: next.billing,
        storage: next.storage,
        seo: next.seo,
        blogMdx: next.blogMdx,
        email: next.email,
        cache: next.cache,
        pwa: next.pwa,
        jobs: next.jobs,
        observability: next.observability,
      });

      logger.success("Updated 0xstack.config.ts");

      const run = await prompts(
        {
          type: "confirm",
          name: "v",
          message: "Run baseline now to apply files and dependencies?",
          initial: true,
        },
        {
          onCancel: () => {
            throw new Error("Cancelled.");
          },
        }
      );

      if (run.v) {
        await runBaseline({ projectRoot: dir, profile, packageManager: pm });
        logger.success("Baseline complete.");
      } else {
        logger.info('Skipped baseline. Run `npx 0xstack baseline` or `npx 0xstack sync --apply` when ready.');
      }
    });
}
