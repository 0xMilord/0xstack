# Changelog

All notable changes to the **[0xstack](https://www.npmjs.com/package/0xstack)** CLI are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The canonical copy for npm tarballs is also published as [`packages/cli/CHANGELOG.md`](./packages/cli/CHANGELOG.md).
Release automation uses [Changesets](https://github.com/changesets/changesets); see [`RELEASING.md`](./RELEASING.md).

## [0.1.6]

### Added

- **Blog reading experience**: Table of contents, reading progress bar, related posts by tags, author bio ("{AppName} Team"), social share buttons (Twitter, LinkedIn, copy link). **Homepage blog section**: Three sample posts with featured badges, responsive grid, "View all posts" link. **Docs navigation**: Auto-generated TOC for PRD/ARCH/ERD, version tracking, last updated date, cross-references. **Storage UX**: Drag-and-drop, progress bar, file validation (10MB max), image thumbnails, delete confirmation, asset count badge. **RSS auto-discovery**: Browser-detectable feed.

### Fixed

- **Homepage server/client error**: Added `"use client"` directive. **CLI permission prompt**: Added `--yes` flag to `pnpm install`. **Code duplication**: Removed duplicate `writeFileEnsured` from `run-init.ts`. **Template literal corruption**: Fixed JSX strings in storage module.

## [Unreleased]

### Fixed

- **`init`**: Choosing **“use the current directory”** no longer fails with `name cannot start with a period`. The scratch folder used for `create-next-app` is now `0xstack-tmp-<timestamp>` instead of `.0xstack-tmp-*`, which satisfies npm / `create-next-app` naming rules.

### Added

- **`doctor --strict`**: optional stricter checks (e.g. generated-domain test stubs, ESLint boundary bundle, module factories).
- **`sync`**: optional **`--lint`**, **`--format`**, and **`--drizzle-generate`** (with **`--apply`**); config validation before planning; docs sync passes **`--profile`**.
- **`upgrade`**: **`--apply`** refreshes PRD hygiene (config keys, runtime Zod schema, ESLint boundaries file, **`lib/services/module-factories.ts`**, Vitest stub).
- **`release`**: runs **`npx @changesets/cli status`** when a **`.changeset`** directory exists.
- **`git commit`**: prompted conventional commits, or **`-m` / `--message`** for non-interactive use.
- **`wrap`**: help text extended for new operator commands.
- **Baseline / modules**: consolidated **module validate** after activation; **`lib/seo/runtime.ts`** when SEO is enabled; **`getBillingService` / `getStorageService` / `getSeoConfig`** factories in generated apps; **`eslint.0xstack-boundaries.mjs`** + Vitest tooling after **`baseline`**.
- **Domain generator**: repo/API/form/test fixes; list hook uses a server action when **`--with-api`**.

### Documentation

- **README**: SEO-friendly sections, **T3 Stack** / **TanStack Query** comparisons, FAQ, architecture diagrams, **0xstack** vs **oxstack** naming.

## [0.1.1]

### Changed

- **Generated apps**: generation writes explicit routes under `app/app/` instead of an `app/app/(workspace)/` segment. Org/workspace access remains enforced via pages, loaders, and cookies rather than a route-group layout.

## [0.1.0]

### Added

- Initial public release of the **0xstack** CLI (`npx 0xstack`, package **`0xstack`** on npm).
- **Commands**: **`init`** (wizard + flags), **`baseline`**, **`doctor`**, **`sync`**, **`docs-sync`**, **`generate <domain>`**, **`add <module>`**, **`modules`**, **`config-print`**, **`config-validate`**, **`deps`**, **`wizard`**, **`shadcn` / `auth` / `drizzle`** passthroughs, **`git init`**, **`git status`**.
- **Config**: typed **`0xstack.config.ts`**, **profiles** (`core`, `full`), progressive **module** activation (billing, storage, SEO, blog, email, PWA, jobs, observability).
- **Stack defaults**: **Next.js App Router**, **Drizzle** + Postgres (Supabase-friendly), **Better Auth**, **TanStack Query**, **Zod**, server actions + **`/api/v1/*`** surface, **shadcn**-aligned UI baseline.
