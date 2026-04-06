import fs from "node:fs/promises";
import path from "node:path";
import { execCmd } from "../exec";
import { logger } from "../logger";

export type ReleaseInput = { projectRoot: string };

export type ReleaseResult = {
  hasChangeset: boolean;
  /** Actionable strings for CLIs / tests when Changesets is absent or optional. */
  hints: string[];
};

/**
 * PRD: changesets-oriented release helper — no full "engine"; shells out when tooling exists.
 */
export async function runRelease(input: ReleaseInput): Promise<ReleaseResult> {
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
    logger.info("Maintainer release from repo root: pnpm release:dry-run → pnpm release");
    logger.info("Optional Changesets: https://github.com/changesets/changesets — pnpm dlx @changesets/cli init");
    return {
      hasChangeset: false,
      hints: [
        "Run `pnpm release:dry-run` then `pnpm release` from the monorepo root (see RELEASING.md).",
        "Optional: add Changesets with `pnpm dlx @changesets/cli init` for PR-based versioning.",
      ],
    };
  }

  logger.info("Running changeset status via npx (what would ship)…");
  try {
    await execCmd("npx", ["--yes", "@changesets/cli", "status"], { cwd: root });
  } catch {
    logger.warn("changeset CLI failed. Install @changesets/cli in this repo or use npx.");
    logger.info("Docs: RELEASING.md for the full release pipeline.");
  }

  return { hasChangeset: true, hints: [] };
}
