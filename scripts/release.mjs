#!/usr/bin/env node
/**
 * Local release pipeline for 0xstack CLI (monorepo root).
 * Bump type is chosen interactively (or via RELEASE_BUMP / RELEASE_SUMMARY env).
 *
 * Usage: pnpm release | pnpm release:dry-run
 */

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CLI_DIR = join(ROOT, "packages", "cli");
const CLI_PKG_PATH = join(CLI_DIR, "package.json");
const CLI_CHANGELOG = join(CLI_DIR, "CHANGELOG.md");

const DRY_RUN = process.argv.includes("--dry-run");

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  if (DRY_RUN) return "";
  return execSync(cmd, {
    cwd: opts.cwd ?? ROOT,
    stdio: opts.stdio ?? "inherit",
    encoding: opts.encoding ?? "utf8",
    ...opts,
  });
}

function readPkg() {
  return JSON.parse(readFileSync(CLI_PKG_PATH, "utf8"));
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split(".").map(Number);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function changelogHeading(kind) {
  if (kind === "major") return "Major Changes";
  if (kind === "minor") return "Minor Changes";
  return "Patch Changes";
}

function prependChangelog(version, kind, summary) {
  const heading = changelogHeading(kind);
  const block = `## ${version}\n\n### ${heading}\n\n- ${summary.trim().replace(/\n/g, "\n  ")}\n\n`;
  const prev = existsSync(CLI_CHANGELOG)
    ? readFileSync(CLI_CHANGELOG, "utf8")
    : "# Changelog\n\n";
  if (!prev.startsWith("# Changelog")) {
    writeFileSync(CLI_CHANGELOG, `# Changelog\n\n${block}${prev}`);
    return;
  }
  const rest = prev.replace(/^# Changelog\s*\n+/i, "");
  writeFileSync(CLI_CHANGELOG, `# Changelog\n\n${block}${rest}`);
}

function gzipSizeBytes(filePath) {
  const buf = readFileSync(filePath);
  return gzipSync(buf).length;
}

async function promptBump() {
  const fromEnv = process.env.RELEASE_BUMP?.toLowerCase();
  if (fromEnv === "major" || fromEnv === "minor" || fromEnv === "patch") {
    return fromEnv;
  }
  const rl = createInterface({ input, output });
  try {
    const line = await rl.question(
      "Bump: [1] patch  [2] minor  [3] major  (enter number): ",
    );
    const n = line.trim();
    if (n === "3") return "major";
    if (n === "2") return "minor";
    return "patch";
  } finally {
    await rl.close();
  }
}

async function promptSummary() {
  const fromEnv = process.env.RELEASE_SUMMARY?.trim();
  if (fromEnv) return fromEnv;
  const rl = createInterface({ input, output });
  try {
    const line = await rl.question("Release summary (one line): ");
    const s = line.trim();
    if (!s) {
      console.error("Summary is required.");
      process.exit(1);
    }
    return s;
  } finally {
    await rl.close();
  }
}

function branchExists(name) {
  try {
    execSync(`git rev-parse --verify ${name}`, { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function workingTreePorcelain() {
  return execSync("git status --porcelain", {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

/** Real release mutates git + npm; require a clean tree so pull/commit/tag stay predictable. */
function assertCleanWorkingTree() {
  const lines = workingTreePorcelain();
  if (!lines) return;
  console.error("\n❌ Refusing to release: working tree is not clean.\n");
  for (const line of lines.split("\n")) {
    console.error(`   ${line}`);
  }
  console.error(
    "\nThese paths are already changed locally — the release script did not create this state.",
  );
  console.error(
    "Fix: commit, restore, or stash (e.g. git stash push -u -m pre-release), then run pnpm release again.",
  );
  console.error("To see what changed: git status\n");
  process.exit(1);
}

function verifyInstall(version) {
  const dir = mkdtempSync(join(tmpdir(), "0xstack-verify-"));
  try {
    run(`npm init -y`, { cwd: dir });
    run(`npm install 0xstack@${version}`, { cwd: dir });
    run(`npx --yes 0xstack --help`, { cwd: dir });
    console.log("✅ Verify install + --help OK");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`\n0xstack CLI release${DRY_RUN ? " (dry run)" : ""}\n`);

  const dirty = workingTreePorcelain();
  if (dirty && DRY_RUN) {
    console.warn(
      "⚠️  Working tree has local changes. A real `pnpm release` will stop until the tree is clean.\n",
    );
  }

  if (!DRY_RUN) {
    assertCleanWorkingTree();
    console.log("[0] Switching to main…");
    run("git checkout main");
    // --no-rebase avoids "cannot pull with rebase: You have unstaged changes" when pull.rebase is set
    run("git fetch origin main");
    run("git merge --ff-only FETCH_HEAD");
  }

  console.log("[1] Install (workspace)…");
  run("pnpm install --frozen-lockfile");

  console.log("[2] Lint / typecheck…");
  run("pnpm lint");
  run("pnpm typecheck");

  console.log("[3] Tests with coverage…");
  run("pnpm test:coverage");

  console.log("[4] Build…");
  run("pnpm build");

  console.log("[5] Bundle size (gzip, informational)…");
  const distMain = join(CLI_DIR, "dist", "index.js");
  if (!existsSync(distMain)) {
    console.error("❌ Missing packages/cli/dist/index.js after build");
    process.exit(1);
  }
  const gz = gzipSizeBytes(distMain);
  console.log(`   packages/cli/dist/index.js gzip ≈ ${gz} bytes`);

  const pkgBefore = readPkg();
  const current = pkgBefore.version;

  console.log("[6] Version bump…");
  const bumpKind = await promptBump();
  const newVersion = bumpVersion(current, bumpKind);
  console.log(`   ${current} → ${newVersion} (${bumpKind})`);

  const summary = await promptSummary();

  if (DRY_RUN) {
    console.log("\n[dry-run] Would:");
    console.log(`  - Set packages/cli version to ${newVersion}`);
    console.log(`  - Prepend CHANGELOG section (${changelogHeading(bumpKind)})`);
    console.log(`  - git commit → publish → tag v${newVersion} + push`);
    console.log(`  - npm install smoke in temp dir`);
    console.log("\n✅ Dry run complete.\n");
    process.exit(0);
  }

  pkgBefore.version = newVersion;
  writeFileSync(CLI_PKG_PATH, JSON.stringify(pkgBefore, null, 2) + "\n");
  prependChangelog(newVersion, bumpKind, summary);

  console.log("[7] Commit…");
  run("git add packages/cli/package.json packages/cli/CHANGELOG.md");
  run(`git commit -m "chore: release v${newVersion}"`);

  console.log("[8] Publish to npm (before pushing tag, avoids CI race)…");
  run("pnpm --filter 0xstack publish --access public --no-git-checks");

  console.log("[9] Tag + push…");
  run(`git tag v${newVersion}`);
  run("git push origin main");
  run(`git push origin v${newVersion}`);

  console.log("[10] Post-publish verify (retrying for registry lag)…");
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      if (i > 0) {
        const wait = 4000 * i;
        console.log(`   …waiting ${wait}ms before retry ${i + 1}/5`);
        await new Promise((r) => setTimeout(r, wait));
      }
      verifyInstall(newVersion);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;

  const back = branchExists("develop") ? "develop" : null;
  if (back) {
    console.log(`[11] Returning to ${back}…`);
    run(`git checkout ${back}`);
  }

  console.log(`\n✅ Published 0xstack@${newVersion}\n`);
}

main().catch((err) => {
  console.error("\n❌ Release failed:", err.message ?? err);
  if (!DRY_RUN && branchExists("develop")) {
    try {
      execSync("git checkout develop", { cwd: ROOT, stdio: "inherit" });
    } catch {
      /* ignore */
    }
  }
  process.exit(1);
});
