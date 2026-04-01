import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../logger";
import {
  ensureConfigFileKeysUpToDate,
  ensureConfigRuntimeSchemaUpToDate,
  ensureOptionalEnvSchemaStubs,
  ensurePrdArchitectureTooling,
} from "../baseline/run-baseline";

export type UpgradeInput = { projectRoot: string; apply: boolean };

export async function runUpgrade(input: UpgradeInput) {
  const pkg = path.join(input.projectRoot, "package.json");
  try {
    await fs.access(pkg);
  } catch {
    throw new Error(`Not a project root: ${input.projectRoot}`);
  }

  logger.info("Upgrade (0xstack conventions):");
  logger.info(`- dir: ${input.projectRoot}`);
  logger.info(`- apply: ${input.apply ? "yes" : "no (plan only)"}`);
  logger.info("");
  logger.info("Plan steps when --apply:");
  logger.info("  1. Optional env schema stubs (Stripe/S3/Supabase)");
  logger.info("  2. Merge-safe 0xstack.config.ts module keys");
  logger.info("  3. lib/0xstack/config.ts runtime Zod shape upgrades");
  logger.info("  4. PRD tooling: eslint boundaries, module factories, vitest config + test script");
  logger.info("");
  logger.info("Out of scope (future codemods): refactors, route moves, AST migrations.");

  if (!input.apply) {
    logger.info("Re-run with --apply to execute.");
    return;
  }

  await ensureOptionalEnvSchemaStubs(input.projectRoot);
  await ensureConfigFileKeysUpToDate(input.projectRoot);
  await ensureConfigRuntimeSchemaUpToDate(input.projectRoot);
  await ensurePrdArchitectureTooling(input.projectRoot);
  logger.success("Upgrade apply finished. Run `0xstack doctor` and your test/lint scripts.");
}
