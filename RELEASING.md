# Packages & release cycle — `0xstack`

Publishable package: **[`0xstack` on npm](https://www.npmjs.com/package/0xstack)** (`packages/cli`).

## One-command release

From the **repository root** (pnpm workspace):

```bash
pnpm release:dry-run   # recommended first: runs gates, prints plan, no git/npm writes
pnpm release           # interactive bump (patch / minor / major) + summary, then full pipeline
```

### What `pnpm release` does

1. `git checkout main` and `git pull origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm lint` → `pnpm typecheck`
4. `pnpm test:coverage` (fails on Vitest threshold violations)
5. `pnpm build`
6. Logs gzip size of `packages/cli/dist/index.js` (informational; no hard cap)
7. Prompts for **bump** (1 = patch, 2 = minor, 3 = major) and a **one-line summary**
8. Writes `packages/cli/package.json` version and prepends `packages/cli/CHANGELOG.md`
9. `git commit`, then `pnpm --filter 0xstack publish` (before pushing the tag, so tag-triggered CI does not race npm)
10. `git tag vX.Y.Z`, `git push origin main`, `git push origin vX.Y.Z`
11. Smoke test: temp directory `npm install 0xstack@X.Y.Z` and `npx 0xstack --help` (retries for registry lag)
12. If branch `develop` exists, `git checkout develop`

If any step fails, the script stops. **`pnpm release` requires a clean enough tree**: you must not leave uncommitted changes under **`packages/cli`** (or other paths that affect what ships). Uncommitted edits **only** under `scripts/`, `.github/`, `RELEASING.md`, or `.qwen/` (local agent/IDE settings) are ignored so you can iterate on release tooling without a prior commit. For a fully clean tree only, set **`RELEASE_STRICT_CLEAN=1`**. Otherwise: commit, stash, or restore anything else first.

If `git pull` used to fail with *cannot pull with rebase: You have unstaged changes*, that was Git refusing to rebase-pull with a dirty tree — not the release script deleting files. Fix the tree, then re-run.

### Non-interactive (CI or scripts)

```bash
set RELEASE_BUMP=patch
set RELEASE_SUMMARY=Fix thing X
pnpm release
```

(Use `export` on Unix.)

### Rollback notes

- **npm**: `npm deprecate 0xstack@X.Y.Z "message"` or unpublish within npm policy windows.
- **git**: delete local/remote tag if needed: `git push origin :refs/tags/vX.Y.Z`

### Optional: Changesets

The repo still includes `@changesets/cli` for optional versioning PRs. The primary maintainer flow above does **not** require `.changeset/*.md` files. To publish via Changesets only: `pnpm publish:changesets` after `pnpm version-packages`.

## GitHub Actions

| Workflow        | When                              | Purpose                          |
|----------------|-----------------------------------|----------------------------------|
| `ci.yml`       | PR / push to `main` or `develop` | Lint, typecheck, tests, build    |
| `release.yml`  | **workflow_dispatch** (manual)    | Build + npm publish backup path  |

Configure `NPM_TOKEN` if you use the manual publish workflow. Local `pnpm release` publishes from your machine; the workflow avoids duplicate publishes on tag push.
