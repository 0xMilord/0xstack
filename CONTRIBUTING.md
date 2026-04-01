# Contributing to 0xstack

Thanks for taking the time to contribute.

## Ground rules

- Be respectful and constructive.
- Prefer small PRs that do one thing well.
- If you’re unsure about direction, open an issue first.

## Development setup

### Prerequisites

- Node.js (LTS recommended)
- pnpm (this repo uses `pnpm@10.12.2`)

### Install

```bash
pnpm install
```

### Build / typecheck

```bash
pnpm -C packages/cli typecheck
pnpm -C packages/cli build
```

### Run the CLI locally

```bash
node packages/cli/dist/index.js --help
```

## Changesets (required for user-facing changes)

This repo uses **Changesets** for versioning + changelogs.

If your PR changes behavior for users (features, fixes, breaking changes), add a changeset:

```bash
pnpm changeset
```

Notes:
- Choose **patch/minor/major** appropriately.
- Docs-only changes can skip a changeset.

## Commit / PR expectations

- Keep PR titles clear (what + why).
- Update docs when you change CLI behavior.
- Ensure `pnpm -C packages/cli typecheck` and `pnpm -C packages/cli build` pass.

