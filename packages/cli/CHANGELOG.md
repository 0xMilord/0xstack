# Changelog

All notable changes to this package (**[0xstack on npm](https://www.npmjs.com/package/0xstack)**) are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The same history is maintained at the repository root in [`CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

### Fixed

- **`init`**: **Current directory** installs no longer use a `.0xstack-tmp-*` scratch folder (invalid for `create-next-app` / npm naming). Uses **`0xstack-tmp-<timestamp>`** instead.

### Added

- **`doctor --strict`**, **`sync`** flags **`--lint`**, **`--format`**, **`--drizzle-generate`**, **`upgrade --apply`**, **`release`** (Changesets status), **`git commit`** (prompts or **`-m`**), expanded **`wrap`** help.
- **Baseline**: consolidated **module validate**, **ESLint** boundary file, **module factories**, **Vitest** defaults, **`lib/seo/runtime.ts`** when SEO is on.
- **Generator**: repo/query/API/hook/test corrections for **`generate <domain>`**.

### Documentation

- README: comparisons (**T3 Stack**, TanStack starters), FAQ, diagrams, discovery keywords.

## [0.1.1]

### Changed

- **Generated apps**: explicit **`app/app/`** routes instead of **`app/app/(workspace)/`**; gating unchanged at page/loader level.

## [0.1.0]

### Added

- Initial release: Next.js + Drizzle + Better Auth CLI with modular config, **`baseline`**, **`doctor`**, **`sync`**, **`generate`**, **`add`**, and related commands.
