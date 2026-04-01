---
"0xstack": patch
---

Fixed
init: Choosing “use the current directory” no longer fails with name cannot start with a period. The scratch folder used for create-next-app is now 0xstack-tmp-<timestamp> instead of .0xstack-tmp-*, which satisfies npm / create-next-app naming rules.
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
