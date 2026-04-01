import { runPipeline } from "../pipeline";
import { runDocsSync } from "../docs/run-docs-sync";
import { runBaseline } from "../baseline/run-baseline";
import { computeProjectState } from "../project/project-state";
import { logger } from "../logger";
import fs from "node:fs/promises";
import path from "node:path";
import { applyProfile, ConfigSchema, loadConfig } from "../config";
import { expectedDepsForConfig } from "../deps";
import { diffSnapshots, execCmd, snapshotFiles } from "../exec";

export type SyncInput = {
  projectRoot: string;
  profile: string;
  apply: boolean;
  packageManager?: "pnpm" | "npm";
  lint?: boolean;
};

function pmCmd(pm: "pnpm" | "npm") {
  return pm === "npm" ? "npm" : "pnpm";
}

export async function runSync(input: SyncInput) {
  try {
    const raw = await loadConfig(input.projectRoot);
    ConfigSchema.parse(raw);
    applyProfile(raw, input.profile);
    logger.info("Config + profile merge: schema valid.");
  } catch (e) {
    logger.error(`0xstack config invalid: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }

  const state = await computeProjectState(input.projectRoot, input.profile);
  logger.info("Sync plan:");
  logger.info(`- apply: ${input.apply ? "yes" : "no (plan only)"}`);
  logger.info(`- profile: ${state.appliedProfile}`);
  logger.info(`- modules: ${JSON.stringify(state.modules)}`);
  logger.info(`- detected routes: ${state.routes.length}`);
  logger.info("- PRD reconcile hints: run `0xstack drizzle generate` after schema changes; use `--apply` for baseline + docs.");
  logger.info("- Env: ensure `.env.local` satisfies `lib/env/schema.ts` for enabled modules (doctor checks file-level keys).");

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

  // File-level impact (best-effort): surface obvious removals when modules are disabled.
  try {
    const cfg = applyProfile(await loadConfig(input.projectRoot), input.profile);
    const absentIfDisabled: string[] = [];
    const addAll = (xs: string[]) => absentIfDisabled.push(...xs);
    if (cfg.modules.billing === false) {
      addAll([
        "app/api/v1/billing/checkout/route.ts",
        "app/api/v1/billing/portal/route.ts",
        "app/api/v1/billing/webhook/route.ts",
        "app/pricing/page.tsx",
        "app/billing/success/page.tsx",
        "app/billing/cancel/page.tsx",
        "app/app/(workspace)/billing/page.tsx",
      ]);
    }
    if (cfg.modules.storage === false) {
      addAll([
        "app/api/v1/storage/sign-upload/route.ts",
        "app/api/v1/storage/sign-read/route.ts",
        "app/api/v1/storage/assets/route.ts",
        "app/api/v1/storage/assets/[assetId]/route.ts",
        "app/app/(workspace)/assets/page.tsx",
        "app/app/(workspace)/assets/assets-client.tsx",
        "app/app/(workspace)/assets/[assetId]/page.tsx",
      ]);
    }
    if (!cfg.modules.blogMdx) addAll(["app/blog/page.tsx", "app/blog/[slug]/page.tsx", "app/rss.xml/route.ts"]);
    if (!cfg.modules.seo) {
      addAll([
        "app/robots.ts",
        "app/sitemap.ts",
        "app/opengraph-image.tsx",
        "app/twitter-image.tsx",
        "lib/seo/jsonld.ts",
        "lib/seo/runtime.ts",
      ]);
    }
    if (cfg.modules.email !== "resend") addAll(["lib/email/auth-emails.ts"]);
    if (!cfg.modules.pwa) addAll(["app/api/v1/pwa/push/subscribe/route.ts", "public/manifest.webmanifest"]);
    if (!cfg.modules.jobs?.enabled) addAll(["app/api/v1/jobs/reconcile/route.ts"]);

    const present: string[] = [];
    for (const rel of absentIfDisabled) {
      const p = path.join(input.projectRoot, ...rel.split("/"));
      try {
        await fs.access(p);
        present.push(rel);
      } catch {
        // absent ok
      }
    }
    if (present.length) {
      logger.info(`- removals (if apply): ${present.length} disabled-module files currently present`);
      for (const f of present.slice(0, 25)) logger.info(`  - would remove: ${f}`);
      if (present.length > 25) logger.info("  - ...");
    }
  } catch {
    // ignore
  }

  if (!input.apply) {
    logger.info("No changes applied. Re-run with `--apply` to execute baseline + docs sync.");
    logger.info("Optional: `--apply --lint` runs `pnpm|npm run lint` when a lint script exists.");
    return;
  }

  const before = await snapshotFiles(input.projectRoot);
  await runPipeline([
    {
      name: "baseline (reconcile deps/files)",
      run: async () => {
        await runBaseline({
          projectRoot: input.projectRoot,
          profile: input.profile,
          packageManager: input.packageManager ?? "pnpm",
        });
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

  if (input.lint) {
    try {
      const pkgPath = path.join(input.projectRoot, "package.json");
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")) as { scripts?: Record<string, string> };
      const pm = input.packageManager ?? "pnpm";
      if (pkg.scripts?.lint) {
        logger.info("Running lint script (sync --lint)…");
        const cmd = pmCmd(pm);
        const args = pm === "npm" ? ["run", "lint"] : ["run", "lint"];
        await execCmd(cmd, args, { cwd: input.projectRoot });
      } else {
        logger.warn("sync --lint skipped: no `lint` script in package.json");
      }
    } catch (e) {
      logger.warn(`sync --lint failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const after = await snapshotFiles(input.projectRoot);
  const diff = diffSnapshots(before, after);
  logger.info(`Sync applied. Files: added=${diff.added.length} changed=${diff.changed.length} removed=${diff.removed.length}`);
  for (const f of diff.added.slice(0, 15)) logger.info(`  + ${path.relative(input.projectRoot, f).replaceAll("\\", "/")}`);
  for (const f of diff.changed.slice(0, 15)) logger.info(`  ~ ${path.relative(input.projectRoot, f).replaceAll("\\", "/")}`);
  for (const f of diff.removed.slice(0, 15)) logger.info(`  - ${path.relative(input.projectRoot, f).replaceAll("\\", "/")}`);
}

