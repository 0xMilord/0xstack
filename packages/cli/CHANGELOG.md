# Changelog

## 0.1.4

### Patch Changes

- f6c8eb9: Fixed issue When initIntoCurrentDir is true, effectiveDir is set to tempDir (line 103), but by the time the "normalize" step runs, the files have already been moved to targetDir. The effectiveDir variable is never updated. Now fixed on 0.1.4 patch

## 0.1.3

### Patch Changes

- 76cce79: Expanded the SEO module to generate stronger sitewide and per-page metadata with canonical URLs plus Open Graph/Twitter defaults, added richer JSON-LD utilities (safe JSON-LD serialization plus Organization and WebSite generators), and updated the SEO activation to idempotently patch app/layout.tsx to export metadata and inject sitewide JSON-LD scripts; additionally, updated the UI foundation and billing modules so key marketing and billing pages (/, /about, /contact, /terms, /privacy, /pricing, /billing/success, /billing/cancel) ship explicit rich preview metadata instead of relying on generic defaults, while keeping the global OG/Twitter image routes intact.

## 0.1.2

### Patch Changes

- b6dbf24: Fixed
  init: Choosing “use the current directory” no longer fails with name cannot start with a period. The scratch folder used for create-next-app is now 0xstack-tmp-<timestamp> instead of .0xstack-tmp-\*, which satisfies npm / create-next-app naming rules.
  Added
  doctor --strict: optional stricter checks (e.g. generated-domain test stubs, ESLint boundary bundle, module factories).
  sync: optional --lint, --format, and --drizzle-generate (with --apply); config validation before planning; docs sync passes --profile.
  upgrade: --apply refreshes PRD hygiene (config keys, runtime Zod schema, ESLint boundaries file, lib/services/module-factories.ts, Vitest stub).
  release: runs npx @changesets/cli status when a .changeset directory exists.
  git commit: prompted conventional commits, or -m / --message for non-interactive use.
  wrap: help text extended for new operator commands.
  Baseline / modules: consolidated module validate after activation; lib/seo/runtime.ts when SEO is enabled; getBillingService / getStorageService / getSeoConfig factories in generated apps; eslint.0xstack-boundaries.mjs + Vitest tooling after baseline.
  Domain generator: repo/API/form/test fixes; list hook uses a server action when --with-api.
  Documentation
  README: SEO-friendly sections, T3 Stack / TanStack Query comparisons, FAQ, architecture diagrams, 0xstack vs oxstack naming.

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
