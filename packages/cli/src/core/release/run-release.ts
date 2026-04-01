import fs from "node:fs/promises";
import path from "node:path";
import { execCmd } from "../exec";
import { logger } from "../logger";

export type ReleaseInput = { projectRoot: string };

/**
 * PRD: changesets-oriented release helper — no full "engine"; shells out when tooling exists.
 */
export async function runRelease(input: ReleaseInput) {
  const root = input.projectRoot;
  const changesetDir = path.join(root, ".changeset");
  const hasChangeset = await fs
    .access(changesetDir)
    .then(() => true)
    .catch(() => false);

  logger.info("Release:");
  logger.info(`- dir: ${root}`);

  if (!hasChangeset) {
    logger.info("No .changeset directory found.");
    logger.info("For monorepos, add Changesets: https://github.com/changesets/changesets");
    logger.info("Then: pnpm dlx @changesets/cli init");
    logger.info("Bump + changelog locally: pnpm changeset version (or npm exec changeset version)");
    return;
  }

  logger.info("Running changeset status via npx (what would ship)…");
  try {
    await execCmd("npx", ["--yes", "@changesets/cli", "status"], { cwd: root });
  } catch {
    logger.warn("changeset CLI failed. Install @changesets/cli in this repo or use npx.");
    logger.info("Docs: RELEASING.md in this repo for the maintainer workflow.");
  }
}
