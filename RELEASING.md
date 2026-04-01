# Releasing `@0xmilord/0xstack` (maintenance + publishing)

This repo uses **Changesets** + **GitHub Actions** to bump versions, publish to **npmjs**, and create **GitHub Releases**.

## Quick mental model

- There is **one** “npm-style registry protocol”. `npm`, `pnpm`, `yarn`, and `bun` are **package managers**, not registries.
- If we publish a version to **npmjs** once, it becomes installable via **all** managers:
  - `npm i …`
  - `pnpm add …`
  - `yarn add …`
  - `bun add …`

## Prerequisites (one-time setup)

### 1) npm account + scope ownership

- Create an account on npmjs.
- Ensure you can publish to the `@0xmilord` scope (user scope or an npm organization).

### 2) Create an npm token (for CI)

- Create an npm **Automation** token (recommended).
- Add it to GitHub repo secrets as:
  - `NPM_TOKEN`

### 3) Confirm package publish config

`packages/cli/package.json` should have:

- `"name": "@0xmilord/0xstack"`
- `"publishConfig": { "registry": "https://registry.npmjs.org", "access": "public" }`

## Day-to-day development commands

### Prerequisites

- Node.js 24
- pnpm (this repo uses `pnpm@10.12.2`)

### Install dependencies

```bash
pnpm install
```

### Typecheck + build the CLI

```bash
pnpm -C packages/cli typecheck
pnpm -C packages/cli build
```

### Run the built CLI locally

```bash
node packages/cli/dist/index.js --help
```

## Standard release flow (recommended: fully automated)

### Step 1) Make your code changes

- Implement features/fixes normally.
- Commit and push to GitHub in a PR.

### Step 2) Add a Changeset (this is what triggers a release)

From the repo root:

```bash
pnpm changeset
```

Pick the bump type:
- **patch**: bugfix, internal improvements
- **minor**: new backwards-compatible features
- **major**: breaking changes

Commit the new file created under `.changeset/` and push it.

### Step 3) Merge to `main`

On pushes to `main`, the workflow in `.github/workflows/release.yml` will:

- If there are pending changesets:
  - Open/update a **Version Packages** PR (version bumps + changelogs)
- If that PR is merged:
  - Publish to **npmjs**
  - Create a **GitHub Release**

## Manual release (fallback if CI is blocked)

Use this if GitHub Actions is down, secrets are misconfigured, or you want a controlled local publish.

### Step 0) Login to npm locally (once per machine)

```bash
npm login
```

### Step 1) (Optional) Add a changeset

```bash
pnpm changeset
```

### Step 2) Apply version bumps + changelogs

```bash
pnpm version-packages
```

### Step 3) Build everything

```bash
pnpm -r build
```

### Step 4) Publish to npmjs

```bash
pnpm release
```

## Verification after publishing

### Install (any manager)

```bash
npm i -g @0xmilord/0xstack
```

Or:

```bash
pnpm add -g @0xmilord/0xstack
yarn global add @0xmilord/0xstack
bun add -g @0xmilord/0xstack
```

### Run

```bash
0xstack --help
```

## Repo visibility (private vs public)

### Keep GitHub repo private for now if

- You’re still changing fundamentals (API surface, naming, templates).
- You’re not ready for support load (issues/PRs/questions).
- You haven’t audited history for secrets or proprietary content.

### Make GitHub repo public when

- You want adoption + trust (people prefer seeing source before running `npx`).
- You’re ready to accept bug reports and maintain release notes.

**Note**: You can publish a **public npm package** even if the GitHub repo is private. It’s valid, but discoverability and trust are usually better with a public repo.

## Common gotchas / troubleshooting

### “403 Forbidden” when publishing

- Your npm account/token doesn’t have permission to publish to `@0xmilord`.
- For a scoped public package, `publishConfig.access` must be `public` (already set).

### Changesets workflow runs but doesn’t publish

- Check that GitHub repo secret `NPM_TOKEN` exists.
- Ensure the token is an **Automation** token or otherwise permitted for publishing.

### npx usage

Because this is scoped, the canonical command is:

```bash
npx @0xmilord/0xstack --help
```

If you want the shorter `npx 0xstack ...`, you’d need to publish an **unscoped** `0xstack` package name (separate decision).

