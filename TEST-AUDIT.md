# 0xstack — Test Suite Audit & Consolidation Plan

**Date:** 2026-04-06  
**Scope:** CLI package tests + generated app tests  
**Verdict:** **3 test files total** covering ~2% of codebase. No integration tests for commands, no e2e tests, no generated app tests beyond trivial stubs.

---

## 1. Current Test Inventory

### 1.1 All Test Files (3 total)

| File | Type | Lines | What It Tests |
|------|------|-------|---------------|
| `packages/cli/tests/unit/config-profile.test.ts` | Unit | 42 | `applyProfile()` merges profiles into config |
| `packages/cli/tests/unit/deps.test.ts` | Unit | 27 | `expectedDepsForConfig()` returns correct deps |
| `packages/cli/tests/integration/cli-help.test.ts` | Integration | 18 | `0xstack --help` prints and exits 0 |

### 1.2 Test Infrastructure

| File | Purpose |
|------|---------|
| `packages/cli/vitest.config.ts` | Basic vitest config, `tests/**/*.test.ts`, node env, `passWithNoTests: false` |
| `packages/cli/package.json` | Scripts: `test`, `test:watch`, `test:coverage` (uses vitest) |

### 1.3 What the Tests Actually Cover

**`config-profile.test.ts` (3 tests):**
- ✅ `applyProfile` returns same config when profile missing
- ✅ `applyProfile` merges profile module patch
- ✅ `applyProfile` deep-merges observability and jobs

**`deps.test.ts` (3 tests):**
- ✅ Baseline deps include expected packages (including `next-themes`)
- ✅ Blog enables `remark-toc` and `@tailwindcss/typography`
- ✅ Dodo billing adds correct packages

**`cli-help.test.ts` (1 test):**
- ✅ `--help` exits 0 and contains "0xstack"

**Total: 7 tests across 3 files. ~80 lines of test code.**

---

## 2. Test Coverage Analysis — CLI Package

### 2.1 Source Files vs Test Files

| Source Directory | Files | Lines | Test Files | Tests | Coverage |
|-----------------|-------|-------|------------|-------|----------|
| `src/index.ts` | 1 | 65 | 0 | 0 | 0% |
| `src/commands/` | 15 | ~1,200 | 0 | 1 (help) | <1% |
| `src/core/init/` | 3 | ~1,100 | 0 | 0 | 0% |
| `src/core/baseline/` | 1 | 1,008 | 0 | 0 | 0% |
| `src/core/doctor/` | 1 | 657 | 0 | 0 | 0% |
| `src/core/generate/` | 4 | ~600 | 0 | 0 | 0% |
| `src/core/modules/` | 23 | ~6,000 | 0 | 0 | 0% |
| `src/core/interactive/` | 1 | 380 | 0 | 0 | 0% |
| `src/core/sync/` | 1 | 230 | 0 | 0 | 0% |
| `src/core/docs/` | 1 | 650 | 0 | 0 | 0% |
| `src/core/add/` | 1 | 50 | 0 | 0 | 0% |
| `src/core/upgrade/` | 1 | 45 | 0 | 0 | 0% |
| `src/core/release/` | 1 | 30 | 0 | 0 | 0% |
| `src/core/config.ts` | 1 | 180 | 1 | 3 | ~15% |
| `src/core/deps.ts` | 1 | 30 | 1 | 3 | ~80% |
| `src/core/config-patch.ts` | 1 | 80 | 0 | 0 | 0% |
| `src/core/pipeline.ts` | 1 | 50 | 0 | 0 | 0% |
| `src/core/exec.ts` | 1 | 40 | 0 | 0 | 0% |
| `src/core/logger.ts` | 1 | 60 | 0 | 0 | 0% |
| `src/core/pm.ts` | 1 | 40 | 0 | 0 | 0% |
| `src/core/modules/fs-utils.ts` | 1 | 60 | 0 | 0 | 0% |
| `src/core/generate/schema-edit.ts` | 1 | 200 | 0 | 0 | 0% |
| `src/core/generate/names.ts` | 1 | 40 | 0 | 0 | 0% |
| `src/core/modules/env-edit.ts` | 1 | 50 | 0 | 0 | 0% |
| `src/core/modules/module-consolidated-validate.ts` | 1 | 80 | 0 | 0 | 0% |
| `src/core/project/project-state.ts` | 1 | 40 | 0 | 0 | 0% |
| `src/core/utils/icon-generator.ts` | 1 | 120 | 0 | 0 | 0% |
| **TOTAL** | **~60** | **~13,000** | **3** | **7** | **~2%** |

### 2.2 Missing Unit Tests (by priority)

#### P0 — Core Logic (No Tests At All)

| File | Functions to Test | Why Critical |
|------|-------------------|-------------|
| `core/config.ts` | `loadConfig()`, `writeDefaultConfig()`, `ConfigSchema` edge cases | Config is the single source of truth for everything |
| `core/config-patch.ts` | `patchConfigModules()`, `ensureObservabilityAndJobsKeys()` | Regex-based patching is fragile — needs tests |
| `core/deps.ts` | All module-specific dep branches (stripe, s3, supabase, email, pwa, sentry) | Only 3 of ~15 branches tested |
| `core/pipeline.ts` | `runPipeline()` with success, retry, failure | Every command uses this |
| `core/exec.ts` | `execCmd()`, `snapshotFiles()`, `diffSnapshots()` | Core execution primitive |
| `core/pm.ts` | `detectPackageManager()`, `pmExec()`, `pmDlx()` | Package manager abstraction |
| `core/modules/fs-utils.ts` | `exists()`, `ensureDir()`, `writeFileEnsured()`, `backupAndRemove()` | File operations used everywhere |
| `core/generate/names.ts` | `toKebab()`, `toCamel()`, `toPascal()`, `pluralize()` | Domain generator depends on these |
| `core/generate/schema-edit.ts` | `upsertDomainTable()`, `ensureOrgsTables()`, `ensureApiKeysTable()`, etc. | Schema manipulation is critical |
| `core/modules/env-edit.ts` | `ensureEnvSchemaModuleWiring()`, `writeBrandingEnv()` | Env file composition |
| `core/modules/module-consolidated-validate.ts` | `runConsolidatedModuleValidate()` | Module validation logic |
| `core/project/project-state.ts` | `computeProjectState()` | Project state computation |
| `core/utils/icon-generator.ts` | `generateAppIcon()`, `generateFaviconDataUrl()` | Icon generation |

#### P1 — Command Logic (No Tests At All)

| Command File | What to Test |
|-------------|-------------|
| `commands/init.ts` | Flag parsing, validation, error handling, current-dir vs new-dir |
| `commands/baseline.ts` | Profile resolution, package manager detection |
| `commands/doctor.ts` | Strict mode, profile selection, output formatting |
| `commands/generate.ts` | Domain name validation, `--with-api` flag |
| `commands/wizard.ts` | Cancel handling, defaults merging |
| `commands/add.ts` | Module ID validation, config update |
| `commands/sync.ts` | Plan vs apply mode |
| `commands/docs-sync.ts` | Profile selection |
| `commands/config-commands.ts` | Print output, validate errors |
| `commands/deps-command.ts` | CLI vs app deps output |
| `commands/wrappers.ts` | Passthrough argument forwarding |
| `commands/git.ts` | Commit prompt, message formatting |
| `commands/release.ts` | Changeset detection |
| `commands/upgrade.ts` | Apply vs plan mode |
| `commands/modules-list.ts` | Output content |

#### P2 — Core Business Logic (No Tests At All)

| File | What to Test |
|------|-------------|
| `core/init/run-init.ts` | Directory validation, Next.js scaffold args, pnpm safety, icon generation, env file creation, DB wiring, proxy.ts generation |
| `core/baseline/run-baseline.ts` | All 17 pipeline steps, profile application, module lifecycle, ESLint patching, vitest config generation, key index generation |
| `core/doctor/run-doctor.ts` | All check categories: env, deps, files, boundaries, CQRS purity, migration drift, module factories |
| `core/generate/run-generate-domain.ts` | Full CQRS slice generation, schema upsert, API route generation, test stub generation |
| `core/sync/run-sync.ts` | Plan detection, apply execution, file cleanup |
| `core/docs/run-docs-sync.ts` | README/PRD/ARCH/ERD generation, lib/*/README.md generation |
| `core/add/run-add-module.ts` | Module enablement, baseline trigger |
| `core/upgrade/run-upgrade.ts` | Config key updates, runtime schema upgrades |
| `core/release/run-release.ts` | Changeset detection, status output |

#### P3 — Module Activation (No Tests At All)

| Module File | What to Test |
|-------------|-------------|
| `auth-core.module.ts` | All 15+ generated files have correct content |
| `core-db-state.module.ts` | Org tables, active-org cookie, repo/service/action generation |
| `ui-foundation.module.ts` | Layout patching, component generation, root layout modification |
| `cache.module.ts` | Cache config, LRU, server cache, revalidation |
| `security-api.module.ts` | API key repo/service, guard, rate limiting, actions, loader, UI |
| `billing-core.module.ts` | Runtime, plans, service, loader, actions, hooks, pages, status API |
| `billing-dodo.module.ts` | Env schema, webhook verification, checkout/portal/webhook routes |
| `billing-stripe.module.ts` | Env schema, Stripe SDK wrapper, checkout/portal/webhook routes |
| `storage-core.module.ts` | Runtime, provider interface, service, loaders, actions, API routes, UI |
| `storage-gcs.module.ts` | GCS env, provider implementation |
| `email-resend.module.ts` | Env schema, Resend client, email templates, auth patching |
| `seo.module.ts` | JSON-LD, metadata, robots, sitemap, OG images, layout patching |
| `blog.module.ts` | MDX content, loader, blog pages, RSS, OG images |
| `pwa.module.ts` | Manifest, SW, offline, push subscriptions, API routes, UI, layout patching |
| `observability.module.ts` | Logger, Sentry configs, env schema |
| `jobs.module.ts` | Reconcile function, route |
| `webhook-ledger.ts` | Repo, service, loader, actions, API routes, UI |

### 2.3 Missing Integration Tests

| Test Scenario | What It Would Do |
|---------------|-----------------|
| **Full init → baseline → doctor flow** | Create temp dir, run init, run baseline, run doctor, verify no critical issues |
| **Init with all modules** | Run init with all modules enabled, verify all files exist |
| **Init with minimal modules** | Run init with only core modules, verify disabled module files absent |
| **Baseline idempotency** | Run baseline twice, verify no duplicate files or errors |
| **Baseline profile switching** | Run baseline with `core` profile, then `full`, verify module activation |
| **Generate domain** | Run generate with a domain name, verify all CQRS files created |
| **Generate domain with API** | Run generate with `--with-api`, verify API routes + hooks created |
| **Doctor detects violations** | Create a file that imports repos from app/, verify doctor catches it |
| **Doctor detects missing files** | Remove a required file, verify doctor reports it |
| **Add module** | Run add with a module ID, verify config updated and baseline runs |
| **Sync plan** | Run sync without --apply, verify plan output |
| **Module disable cleanup** | Disable a module in config, run baseline, verify files removed |
| **Config patching** | Run baseline on old config, verify new keys added |
| **ESLint boundary patching** | Run baseline, verify eslint.config.mjs patched with boundaries |

### 2.4 Missing E2E Tests

| Test Scenario | What It Would Do |
|---------------|-----------------|
| **Full app lifecycle** | Init → baseline → dev server → verify pages load → doctor |
| **Auth flow** | Init → baseline → start dev server → visit /login → verify form renders |
| **Org flow** | Visit /app/orgs → create org → verify redirect to /app |
| **Generated domain** | Generate "posts" domain → verify /app/posts page loads |
| **Billing flow** | Enable billing → baseline → visit /pricing → verify plan cards render |
| **Storage flow** | Enable GCS → baseline → visit /app/assets → verify page loads |

---

## 3. Generated App Test Audit

### 3.1 What Tests Are Generated

The `generate <domain>` command creates 3 test stubs per domain:

| File | What It Tests | Quality |
|------|--------------|---------|
| `tests/<plural>/<plural>.repo.test.ts` | Checks `listX` and `getXById` are functions | ❌ Trivial — only checks exports exist |
| `tests/<plural>/<plural>.rules.test.ts` | Validates create input with valid data | ❌ Trivial — one happy path |
| `tests/<plural>/<plural>.actions.test.ts` | Validates create input rejects missing name | ❌ Trivial — one error path |

### 3.2 Generated App — Missing Test Categories

#### Unit Tests (None Generated)

| Layer | Missing Tests |
|-------|--------------|
| **Repos** | CRUD operations, org scoping, error handling, edge cases (not found, duplicates) |
| **Services** | Business logic, authz checks, transaction handling, error propagation |
| **Loaders** | Caching behavior, tag usage, auth gating, org scoping |
| **Actions** | Input validation, auth checks, org checks, revalidation calls |
| **Rules** | All Zod schemas — valid, invalid, edge cases |
| **Query/Mutation keys** | Key structure, uniqueness |
| **API routes** | Auth (session + API key), rate limiting, error responses, success responses |

#### Integration Tests (None Generated)

| Scenario | What It Would Test |
|----------|-------------------|
| **Full CRUD flow** | Create → Read → Update → Delete via actions, verify DB state |
| **API route + service** | POST to API route → verify service called → verify DB state |
| **Loader → service → repo** | Call loader → verify cached result → verify cache invalidation |
| **Auth gating** | Call action without auth → verify error → call with auth → verify success |
| **Org scoping** | Create item in org A → verify not visible in org B |
| **Cache invalidation** | Mutate data → verify relevant cache tags invalidated |

#### E2E Tests (None Generated)

| Scenario | What It Would Test |
|----------|-------------------|
| **Page renders** | Visit /app/<plural> → verify page loads with correct content |
| **Create flow** | Fill form → submit → verify item appears in list |
| **Auth redirect** | Visit /app/<plural> without auth → verify redirect to /login |
| **API route** | GET /api/v1/<plural>?orgId=X → verify JSON response |

### 3.3 Core Modules — Missing Tests in Generated App

| Module | Missing Test Categories |
|--------|------------------------|
| **Auth** | Login/signup flow, password reset, email verification, session management, viewer loader caching |
| **Orgs** | Create org, select active org, membership checks, role enforcement, cookie management |
| **Billing** | Checkout flow, webhook reconciliation, subscription status reads, plan resolution |
| **Storage** | Signed upload flow, signed read flow, access control, org scoping, delete flow |
| **API Keys** | Create key, verify key, revoke key, rate limiting, prefix lookup |
| **Webhook Ledger** | Idempotency, list events, replay events, provider-specific handling |
| **Cache** | LRU behavior, server cache with tags, revalidation by tag, cache key stability |
| **SEO** | Metadata generation, JSON-LD output, robots.txt, sitemap generation, OG image generation |
| **Blog** | Frontmatter validation, post listing, post retrieval, RSS feed generation |
| **Email** | Template rendering, email sending, auth email wiring |
| **PWA** | Manifest validation, push subscription flow, offline storage, SW registration |
| **Security** | API key verification, rate limiting (Upstash + fallback), error envelope, request ID generation |

---

## 4. Test File Structure — Current vs Recommended

### 4.1 Current Structure (Scattered, Minimal)

```
packages/cli/
├── tests/
│   ├── unit/
│   │   ├── config-profile.test.ts      ← 3 tests
│   │   └── deps.test.ts                ← 3 tests
│   └── integration/
│       └── cli-help.test.ts            ← 1 test
├── vitest.config.ts
└── package.json                        ← test scripts exist
```

### 4.2 Recommended Structure

```
packages/cli/
├── tests/
│   ├── unit/
│   │   ├── config.test.ts              ← ConfigSchema, loadConfig, writeDefaultConfig, applyProfile
│   │   ├── config-patch.test.ts        ← patchConfigModules, ensureObservabilityAndJobsKeys
│   │   ├── deps.test.ts                ← All module dep branches (expand from 3 to ~15 tests)
│   │   ├── pipeline.test.ts            ← runPipeline success, retry, failure
│   │   ├── exec.test.ts                ← execCmd, snapshotFiles, diffSnapshots
│   │   ├── pm.test.ts                  ← detectPackageManager, pmExec, pmDlx
│   │   ├── fs-utils.test.ts            ← exists, ensureDir, writeFileEnsured, backupAndRemove
│   │   ├── names.test.ts               ← toKebab, toCamel, toPascal, pluralize
│   │   ├── schema-edit.test.ts         ← upsertDomainTable, all ensure*Tables functions
│   │   ├── env-edit.test.ts            ← ensureEnvSchemaModuleWiring, writeBrandingEnv
│   │   ├── module-validate.test.ts     ← runConsolidatedModuleValidate
│   │   ├── project-state.test.ts       ← computeProjectState
│   │   └── icon-generator.test.ts      ← generateAppIcon, generateFaviconDataUrl
│   ├── integration/
│   │   ├── cli-help.test.ts            ← --help, --version, unknown command
│   │   ├── init-flow.test.ts           ← Full init with temp directory
│   │   ├── baseline-flow.test.ts       ← Full baseline, idempotency
│   │   ├── doctor-flow.test.ts         ← Doctor on clean app, doctor with violations
│   │   ├── generate-domain.test.ts     ← Generate domain, verify files
│   │   ├── add-module.test.ts          ← Add module, verify config + files
│   │   ├── sync-flow.test.ts           ← Sync plan and apply
│   │   ├── config-commands.test.ts     ← config-print, config-validate
│   │   └── module-disable.test.ts      ← Disable module, verify cleanup
│   └── e2e/
│       ├── full-app-lifecycle.test.ts  ← Init → baseline → doctor → verify
│       ├── generated-app-pages.test.ts ← Start dev server, verify pages load
│       └── auth-flow.test.ts           ← Login/signup flow in generated app
├── vitest.config.ts
├── vitest.config.e2e.ts                ← Separate config for e2e (longer timeouts)
└── package.json
```

### 4.3 Generated App Recommended Structure

```
<generated-app>/
├── tests/
│   ├── unit/
│   │   ├── repos/
│   │   │   ├── orgs.repo.test.ts
│   │   │   ├── assets.repo.test.ts
│   │   │   ├── billing.repo.test.ts
│   │   │   ├── api-keys.repo.test.ts
│   │   │   └── <generated-domain>.repo.test.ts
│   │   ├── services/
│   │   │   ├── orgs.service.test.ts
│   │   │   ├── storage.service.test.ts
│   │   │   ├── billing.service.test.ts
│   │   │   ├── api-keys.service.test.ts
│   │   │   └── <generated-domain>.service.test.ts
│   │   ├── rules/
│   │   │   ├── orgs.rules.test.ts
│   │   │   ├── api-keys.rules.test.ts
│   │   │   └── <generated-domain>.rules.test.ts
│   │   ├── cache/
│   │   │   ├── lru.test.ts
│   │   │   ├── server-cache.test.ts
│   │   │   └── revalidate.test.ts
│   │   ├── security/
│   │   │   ├── api-guard.test.ts
│   │   │   ├── rate-limit.test.ts
│   │   │   └── error-envelope.test.ts
│   │   └── utils/
│   │       └── logger.test.ts
│   ├── integration/
│   │   ├── auth/
│   │   │   ├── login-flow.test.ts
│   │   │   ├── signup-flow.test.ts
│   │   │   └── viewer-loader.test.ts
│   │   ├── orgs/
│   │   │   ├── create-org-flow.test.ts
│   │   │   └── active-org-cookie.test.ts
│   │   ├── billing/
│   │   │   ├── webhook-reconciliation.test.ts
│   │   │   └── subscription-status.test.ts
│   │   ├── storage/
│   │   │   ├── signed-upload-flow.test.ts
│   │   │   └── access-control.test.ts
│   │   └── api/
│   │       ├── api-key-auth.test.ts
│   │       └── rate-limiting.test.ts
│   └── e2e/
│       ├── pages/
│       │   ├── home.spec.ts
│       │   ├── login.spec.ts
│       │   ├── orgs.spec.ts
│       │   ├── settings.spec.ts
│       │   └── billing.spec.ts
│       └── api/
│           ├── health.spec.ts
│           └── viewer.spec.ts
├── playwright.config.ts
└── vitest.config.ts
```

---

## 5. Test Count Estimates

### CLI Package

| Category | Current | Recommended | Gap |
|----------|---------|-------------|-----|
| Unit tests | 6 | ~60 | +54 |
| Integration tests | 1 | ~30 | +29 |
| E2E tests | 0 | ~10 | +10 |
| **Total** | **7** | **~100** | **+93** |

### Generated App (per module)

| Category | Current (per domain) | Recommended | Gap |
|----------|---------------------|-------------|-----|
| Unit tests | 3 (trivial stubs) | ~15 | +12 |
| Integration tests | 0 | ~8 | +8 |
| E2E tests | 0 | ~3 | +3 |
| **Total per domain** | **3** | **~26** | **+23** |

### Generated App (core modules, not domain-generated)

| Module | Recommended Tests |
|--------|------------------|
| Auth | ~15 |
| Orgs | ~12 |
| Billing | ~10 |
| Storage | ~10 |
| API Keys | ~8 |
| Webhook Ledger | ~6 |
| Cache | ~8 |
| Security | ~8 |
| SEO | ~5 |
| Blog | ~6 |
| Email | ~4 |
| PWA | ~6 |
| Observability | ~4 |
| Jobs | ~3 |
| UI Foundation | ~4 |
| **Total core** | | **~109** |

---

## 6. Specific Test Cases to Write (CLI Package — Priority Order)

### P0 — Unit Tests (Core Logic)

```
config.test.ts:
  - ConfigSchema parses empty config with defaults
  - ConfigSchema rejects invalid module values
  - ConfigSchema accepts full profile config
  - loadConfig returns defaults when no config file
  - loadConfig parses .ts config via jiti
  - writeDefaultConfig creates file with correct content
  - writeDefaultConfig skips if file exists
  - writeDefaultConfig includes all module flags

config-patch.test.ts:
  - patchConfigModules adds missing key
  - patchConfigModules updates existing key
  - patchConfigModules handles multi-line values
  - ensureObservabilityAndJobsKeys adds missing keys

deps.test.ts (expand from 3 to ~15):
  - Stripe billing adds stripe package
  - S3 storage adds AWS SDK packages
  - Supabase storage adds supabase-js
  - Resend email adds resend + react-email
  - Cache adds lru-cache
  - PWA adds web-push + idb
  - Sentry adds @sentry/nextjs
  - SEO adds schema-dts
  - All module combos don't duplicate deps

pipeline.test.ts:
  - runPipeline executes all steps sequentially
  - runPipeline stops on first failure
  - runPipeline handles skip results
  - runPipeline retries on failure with backoff

names.test.ts:
  - toKebab converts camelCase, PascalCase, spaces
  - toCamel converts kebab-case, PascalCase
  - toPascal converts kebab-case, camelCase
  - pluralize handles regular and irregular nouns

fs-utils.test.ts:
  - exists returns true for existing file
  - exists returns false for missing file
  - ensureDir creates nested directories
  - writeFileEnsured creates parent directories
  - backupAndRemove moves file to .0xstack/disabled/
  - backupAndRemove handles missing file gracefully

schema-edit.test.ts:
  - upsertDomainTable adds table when missing
  - upsertDomainTable updates table when exists
  - ensureOrgsTables adds orgs table
  - ensureApiKeysTable adds api_keys table
  - ensureAssetsTable adds assets table
  - ensureBillingTables adds billing tables
  - ensureWebhookEventsTable adds webhook_events table
  - ensurePushTables adds push_subscriptions table
  - ensureAuthTables adds auth tables
```

### P1 — Integration Tests

```
init-flow.test.ts:
  - Init creates Next.js app in new directory
  - Init with --yes skips prompts
  - Init with current-dir mode works
  - Init rejects non-empty directory
  - Init generates correct .env.example
  - Init generates drizzle.config.ts
  - Init generates lib/db/schema.ts with userProfiles
  - Init generates lib/auth/auth.ts
  - Init generates proxy.ts
  - Init generates 0xstack.config.ts

baseline-flow.test.ts:
  - Baseline installs deps for enabled modules
  - Baseline generates Better Auth schema
  - Baseline activates modules
  - Baseline is idempotent (run twice, no errors)
  - Baseline with core profile enables minimal modules
  - Baseline with full profile enables all modules
  - Baseline generates ESLint boundaries file
  - Baseline generates vitest config
  - Baseline generates module factories
  - Baseline generates query/mutation key indices

doctor-flow.test.ts:
  - Doctor passes on clean baseline app
  - Doctor detects missing env vars
  - Doctor detects missing deps
  - Doctor detects architecture boundary violations
  - Doctor detects CQRS purity violations
  - Doctor detects missing files
  - Doctor strict mode checks test stubs
  - Doctor reports health score

generate-domain.test.ts:
  - Generate creates all CQRS files
  - Generate with --with-api creates API routes + hooks
  - Generate without --with-api skips API routes
  - Generate upserts schema table
  - Generate creates test stubs
  - Generate handles domain name normalization

add-module.test.ts:
  - Add enables module in config
  - Add runs baseline after enabling
  - Add rejects invalid module ID

module-disable.test.ts:
  - Disable billing removes billing files
  - Disable storage removes storage files
  - Disable blog removes blog files
  - Disabled module leaves shared libs intact
```

### P2 — E2E Tests

```
full-app-lifecycle.test.ts:
  - Init → baseline → doctor → zero critical issues
  - Init with all modules → baseline → all module files exist
  - Init → generate domain → doctor → no violations

generated-app-pages.test.ts:
  - Start dev server → / loads
  - Start dev server → /login loads
  - Start dev server → /app/orgs loads (with auth mock)
  - Start dev server → /api/v1/health returns 200

auth-flow.test.ts:
  - Mock Better Auth → signup → redirect to /app/orgs
  - Mock Better Auth → login → redirect to /app
  - Mock Better Auth → viewer API returns user
```

---

## 7. Consolidation Actions

### Step 1: Fix Existing Tests
- `deps.test.ts` already tests `next-themes`, `remark-toc`, `@tailwindcss/typography` — ✅ correct
- `config-profile.test.ts` — ✅ adequate for now
- `cli-help.test.ts` — expand to test `--version` and unknown commands

### Step 2: Add P0 Unit Tests
Write tests for: `config.ts`, `config-patch.ts`, `pipeline.ts`, `names.ts`, `fs-utils.ts`, `schema-edit.ts`, `deps.ts` (expand)

### Step 3: Add P1 Integration Tests
Write tests for: init flow, baseline flow, doctor flow, generate domain, add module, module disable

### Step 4: Add Generated App Test Templates
Update `run-generate-domain.ts` to generate better test stubs:
- Repo tests: actual CRUD with mock DB
- Service tests: business logic with mocked repos
- Rule tests: all validation cases
- Action tests: auth + org gating

### Step 5: Add E2E Test Infrastructure
- Add Playwright config to baseline
- Add basic page load tests
- Add API route tests

---

## 8. Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| CLI test files | 3 | ~30 | +27 |
| CLI test count | 7 | ~100 | +93 |
| CLI coverage | ~2% | ~70% | +68% |
| Generated app tests per domain | 3 (stubs) | ~26 | +23 |
| Generated app core module tests | 0 | ~109 | +109 |
| E2E tests (CLI) | 0 | ~10 | +10 |
| E2E tests (generated app) | 0 | ~15 | +15 |
| **Total test files** | **3** | **~65** | **+62** |
| **Total test count** | **7** | **~260** | **+253** |

The CLI has **zero e2e tests**, **1 integration test**, and **6 unit tests** across a **13,000-line codebase**. The generated app gets **3 trivial test stubs per domain** and **zero tests for core modules**. This is the single biggest gap between "enterprise-grade" claims and reality.
