import { runPipeline } from "../pipeline";
import { runDocsSync } from "../docs/run-docs-sync";
import { runBaseline } from "../baseline/run-baseline";
import { computeProjectState } from "../project/project-state";
import { logger } from "../logger";
import fs from "node:fs/promises";
import path from "node:path";
import { applyProfile, loadConfig } from "../config";
import { expectedDepsForConfig } from "../deps";

export type SyncInput = { projectRoot: string; profile: string; apply: boolean };

export async function runSync(input: SyncInput) {
  const state = await computeProjectState(input.projectRoot, input.profile);
  logger.info("Sync plan:");
  logger.info(`- apply: ${input.apply ? "yes" : "no (plan only)"}`);
  logger.info(`- profile: ${state.appliedProfile}`);
  logger.info(`- modules: ${JSON.stringify(state.modules)}`);
  logger.info(`- detected routes: ${state.routes.length}`);

  // Dependency drift (best-effort)
  try {
    const cfg = applyProfile(await loadConfig(input.projectRoot), input.profile);
    const expected = expectedDepsForConfig(cfg);
    const pkgPath = path.join(input.projectRoot, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as any;
    const haveDeps = new Set<string>(Object.keys(pkg?.dependencies ?? {}));
    const haveDevDeps = new Set<string>(Object.keys(pkg?.devDependencies ?? {}));
    const missingDeps = expected.deps.filter((d) => !haveDeps.has(d));
    const missingDevDeps = expected.devDeps.filter((d) => !haveDevDeps.has(d));
    const extraDeps = Array.from(haveDeps).filter((d) => expected.deps.includes(d) === false);
    const extraDevDeps = Array.from(haveDevDeps).filter((d) => expected.devDeps.includes(d) === false);
    logger.info(`- deps: missing=${missingDeps.length} extra=${extraDeps.length}`);
    if (missingDeps.length) logger.info(`  - missing deps: ${missingDeps.join(", ")}`);
    if (missingDevDeps.length) logger.info(`  - missing devDeps: ${missingDevDeps.join(", ")}`);
    // “extra” is informational; many apps add their own deps.
    if (extraDeps.length) logger.info(`  - extra deps (info): ${extraDeps.slice(0, 25).join(", ")}${extraDeps.length > 25 ? ", ..." : ""}`);
    if (extraDevDeps.length) logger.info(`  - extra devDeps (info): ${extraDevDeps.slice(0, 25).join(", ")}${extraDevDeps.length > 25 ? ", ..." : ""}`);
  } catch {
    logger.warn("Dep drift check skipped (unable to read package.json/config).");
  }

  if (!input.apply) {
    logger.info("No changes applied. Re-run with `--apply` to execute baseline + docs sync.");
    return;
  }

  await runPipeline([
    {
      name: "baseline (reconcile deps/files)",
      run: async () => {
        await runBaseline({ projectRoot: input.projectRoot, profile: input.profile, packageManager: "pnpm" });
        return { kind: "ok" };
      },
    },
    {
      name: "docs sync",
      run: async () => {
        await runDocsSync({ projectRoot: input.projectRoot });
        return { kind: "ok" };
      },
    },
  ]);
}

