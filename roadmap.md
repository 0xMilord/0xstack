# Roadmap — 0xstack Starter System (7-day build)

Build window: **7 days**. Goal: ship a **working v1** of the 0xstack factory: CLI that can `init` and `baseline` a Next.js (App Router) + Supabase Postgres + Drizzle app, enforce the architecture, and progressively activate modules (auth/orgs required; blog/seo/billing/storage gated).

---

## Guiding constraints (from prior discussion + PRD)

- **Flat layout**: Next.js routes in `app/`, everything else in `lib/`. **No `src/`**. **No `()` route groups**.
- **Auth**: **Better Auth only**. **User IDs are text** (`string`) everywhere; no UUID assumptions.
- **Entrypoints**:
  - **Internal app DB ops**: **server actions** in `lib/actions/*` (write highway).
  - **External clients**: **HTTP API routes** under `app/api/**/route.ts` (external highway).
- **Progressive activation**: installed ≠ activated; disabled modules must not expose routes and should avoid heavy imports.
- **Baseline modules** (PRD): orgs (core), blog (MDX), SEO (robots/sitemap/OG/Twitter/JSON-LD/RSS), billing (Dodo + webhook), storage (GCS signed URLs), security baseline (proxy + headers + CSP + rate limiting), observability baseline (logger; optional Sentry/OTel), jobs (optional driver).
- **Operator commands**: `doctor` (checks), `sync` (reconcile), `docs sync` (marker-based doc regen).
- **Docs outputs**: root `PRD.md`, plus generated `ERD.md` + `ARCHITECTURE.md` inventories and per-`lib/*` READMEs.

---

## Dependency map (build order backbone)

1. **CLI foundation** (command runner, logging, error handling) → needed by every command.
2. **Config system** (`0xstack.config.ts`, `defineConfig`, Zod validation, defaults) → needed for activation gating, baseline, doctor, sync.
3. **Deterministic pipeline engine** (`runPipeline(step[])`) → required for `init`, `baseline`, `doctor`, `sync`.
4. **Template scaffolding + AST transforms** → required for safe reruns / idempotent merges.
5. **Init minimal app** (Next.js + shadcn + env + db wiring + auth handler + UI foundation + orgs core) → required before baseline modules can be activated.
6. **Module lifecycle contract** (`install/activate/validate/sync`) + progressive activation boundaries → required before enabling blog/seo/billing/storage surfaces.
7. **Doctor + Sync** (static checks + reconciliation) → required to keep “factory output” consistent.
8. **Domain generator** (`generate <domain>`) → depends on schema/repo/action patterns + keys/hooks + doc inventory.

---

## Definition of Done (v1 ship gate)

- **CLI**: `npx 0xstack init|baseline|generate|doctor|sync|docs sync` all run deterministically (no accidental prompts unless explicitly required).
- **Progressive activation**:
  - Disabled modules **do not** ship route handlers.
  - Disabled modules avoid heavy top-level imports where practical.
  - Attempting to use a disabled module yields a clear “module not enabled” error.
- **Architecture contracts** enforced:
  - UI and API routes do **not** import repos/DB directly.
  - Read highway uses loaders; write highway uses actions → rules → (service) → repo.
- **Better Auth text IDs**: DB FKs to user use text/varchar; all code types reflect `string`.
- **Baseline app output**: installs, boots, and contains required pages, shells, env validation, and schema wiring.
- **Enterprise surfaces**: security headers + CSP + request IDs + API error envelope + rate limiting are present where required.
- **Docs**: markers-based docs sync works without clobbering user text.
- **Global CSS**: generated app contains the **exact** `app/globals.css` baseline tokens required by the PRD (shadcn layers may be appended, but tokens must not be removed/renamed).

---

## 7-day phase plan (dependency-ordered)

### Day 1 — CLI core + config + pipeline engine (foundation)

- **Deliverables**
  - CLI project structure (commands/core/wrappers/generators/utils) per PRD.
  - **Command framework** (cac/commander), structured logger, error formatting.
  - **Config system**
    - `0xstack.config.ts` scaffold
    - `defineConfig()` + Zod schema + defaults
    - profiles: `milord`, `minimal`
    - module flags: auth (fixed), orgs, blogMdx, seo, billing(dodo/false), storage(gcs/false), observability, jobs
  - **Deterministic pipeline engine**
    - named steps with duration, skip conditions, and clear failure output
    - step result model (ok/skip/fail + metadata)

- **Acceptance checks**
  - `0xstack config validate` (or `doctor` in config-only mode) detects invalid config and prints fixes.
  - Pipeline logs show step boundaries and underlying commands when wrappers are used.
  - Wrapper namespace stubs exist for all baseline wrapped CLIs: `0xstack shadcn ...`, `0xstack auth ...`, `0xstack drizzle ...` (even if only passthrough on Day 1).

---

### Day 2 — `init` minimal (core app skeleton, no optional surfaces activated)

- **Deliverables**
  - `npx 0xstack init` generates a runnable Next.js App Router repo (TS).
  - **Flat layout** created (`app/`, `lib/`, `drizzle/`, `content/`, etc.) with no route groups.
  - **shadcn** installed + base components included; theme provider + theme toggle.
  - **Global CSS**: `app/globals.css` uses the PRD’s required baseline tokens verbatim (plus any required shadcn layers).
  - **Env subsystem** (`lib/env/schema.ts`, `lib/env/server.ts`, `.env.example`) fail-fast in dev.
  - **DB wiring** (Supabase Postgres + Drizzle): `lib/db/index.ts`, `lib/db/schema.ts` as canonical export surface.
  - **Security proxy**: repo-root `proxy.ts` with route protection + request-id propagation + baseline headers/CSP hooks.
  - Marketing + legal pages + app shell pages present per PRD:
    - `/`, `/about`, `/contact`, `/pricing`, `/terms`, `/privacy`, plus `/login`, `/get-started`, `/app/*`

- **Dependencies satisfied for later**
  - Project has a config file, env validation, and the folder structure that doctor/generators will rely on.

- **Acceptance checks**
  - Generated app boots locally (no runtime crashes with placeholder env).
  - Theme toggle works and persists.
  - Proxy redirects unauthenticated `/app/*` to `/login?redirect=...`.

---

### Day 3 — Better Auth integration + baseline schema (auth/profile/orgs core)

- **Deliverables**
  - Better Auth wired end-to-end:
    - `app/api/auth/[...all]/route.ts`
    - `lib/auth/*` server helpers (`getViewer`, `requireAuth`) using `React.cache()`
  - Better Auth schema generated via Better Auth CLI and integrated into Drizzle exports.
  - **Baseline product schema** implemented/verified in `lib/db/schema.ts` (or re-exports):
    - Better Auth tables (generated)
    - `user_profiles` (FK to user.id as **text**)
    - `orgs`, `org_members` (multi-tenant baseline; roles; unique constraints)
  - **Core orgs domain** skeleton (minimum):
    - repo/loader/rules/actions + initial UI stubs under `app/app/orgs/*`
  - CLI wrappers added (passthrough + auditable):
    - `0xstack shadcn ...` (shadcn)
    - `0xstack auth ...` (Better Auth CLI)
    - `0xstack drizzle ...` (drizzle-kit)

- **Acceptance checks**
  - All `userId` columns referencing Better Auth are text/varchar.
  - Internal writes go through server actions; UI does not import repos directly.

---

### Day 4 — Progressive activation + module lifecycle + baseline `baseline` command

- **Deliverables**
  - **Module lifecycle contract** implemented for: orgs (core), blogMdx, seo, billing(dodo), storage(gcs), observability, jobs.
  - **Progressive activation boundaries**
    - route-level gating: module-disabled ⇒ route handlers absent/not emitted
    - import-level gating: dynamic import heavy SDKs when module enabled
    - factory getters: `getBillingService()`, `getStorageService()`, `getSeoConfig()`
  - `npx 0xstack baseline`
    - installs deps (capability-aware)
    - installs files for enabled modules
    - activates enabled modules’ routes/surfaces
    - runs validate + sync steps through pipeline engine

- **Acceptance checks**
  - `baseline --profile=minimal` does not expose blog/billing/storage routes.
  - `baseline --profile=milord` activates all configured modules.

---

### Day 5 — SEO + Blog (MDX) module, fully gated

- **Deliverables**
  - **Blog (MDX)** (module `blogMdx`)
    - `content/blog/*.mdx` source + frontmatter contract + loader
    - `app/blog/page.tsx` (index) + `app/blog/[slug]/page.tsx` (post)
    - RSS route `app/rss.xml/route.ts`
  - **SEO** (module `seo`)
    - `app/robots.ts` + `app/sitemap.ts` with marketing + blog inclusion
    - metadata defaults in root layout; canonical strategy using baseUrl
    - per-post metadata + OG/Twitter
    - JSON-LD helpers that escape `<` → `\\u003c`; sitewide Organization/WebSite + per-post Article
  - **Doctor rules (SEO/blog)**
    - verifies required SEO files when module enabled
    - verifies sitemap includes blog routes when blog enabled

- **Acceptance checks**
  - When disabled: no blog routes, no RSS route, and SEO metadata routes absent (or noop).
  - When enabled: sitemap includes posts; robots points to sitemap; pages emit JSON-LD.

---

### Day 6 — Billing (Dodo) + Storage (GCS) modules + security hardening

- **Deliverables**
  - **Billing (Dodo)** (module `billing: "dodo"`)
    - API routes under `app/api/v1/billing/*`:
      - checkout, portal, webhook
    - webhook signature verification (raw body), **idempotency ledger** (`webhook_events`)
    - `lib/services/billing.service.ts` reconciliation + DB sync tables:
      - `billing_customers`, `billing_subscriptions`
    - rate limit + API auth guard for `app/api/v1/*`
    - standardized API error envelope (`code`, `message`, `requestId`, `details?`)
  - **Storage (GCS)** (module `storage: "gcs"`)
    - signed upload/download URL issuance (V4), short expiry, content-type restrictions
    - canonical object key strategy and `assets` table writes
  - **Security baseline finalized**
    - `lib/security/*` central subsystem (headers/csp/rate-limit/api-auth/request-id)
    - `doctor` checks that proxy + routes use security subsystem

- **Acceptance checks**
  - Webhook route: verifies signature, writes ledger first, acks quickly.
  - Assets: signed URL issuance requires ownership checks.
  - Disabled modules: no billing/storage routes exist.

---

### Day 7 — Generators + Doctor + Sync + Docs + polish (ship hardening)

- **Deliverables**
  - `npx 0xstack generate <domain>`
    - schema additions + migration stub
    - repo/loader/rules/actions
    - query keys + mutation keys + TanStack hooks
    - optional external API route generation
    - UI stubs + route placeholders (explicit routes, no groups)
    - minimal tests per domain (repo/rules/actions) per PRD (warn-only acceptable if time tight, but stubs must exist)
  - `npx 0xstack doctor`
    - env var checks per enabled modules
    - boundary violations (restricted imports)
    - migration state checks
    - checks for security/SEO/billing/storage surfaces when enabled
  - `npx 0xstack sync` + `docs sync`
    - marker-based regeneration for:
      - root docs sections (PRD inventory, ERD, Architecture inventory)
      - per `lib/*` README.md files
    - reconcile config ↔ deps ↔ routes ↔ docs without destructive deletes by default
  - CLI UX polish
    - spinners, clear remediation, idempotent reruns
  - **Optional-but-recommended (PRD)**: stub the namespaces (no “engine”) so teams can extend after v1:
    - `npx 0xstack git ...` (shells out)
    - `npx 0xstack release` (changesets-based in monorepo setups)
  - **Stretch (PRD)**: `npx 0xstack upgrade` codemods hook point (may ship as a no-op placeholder in v1).

- **Acceptance checks**
  - Running `init` then `baseline` then `doctor` succeeds for both `minimal` and `milord` profiles (or produces actionable guidance for missing env).
  - Regenerating docs does not overwrite user-authored text outside markers.

---

## “Don’t miss anything” checklist (feature inventory)

- **Core**
  - `init`, `baseline`, `generate`, `add` (optional), `doctor`, `sync`, `docs sync`
  - pipeline engine, typed config + profiles, wrappers (shadcn/auth/drizzle), idempotency
- **App output**
  - marketing + legal pages, auth pages, app shell, settings page with theme toggle
  - TanStack Query provider + canonical query/mutation key structure
  - ESLint import restrictions + doctor static checks
- **DB**
  - Supabase Postgres + Drizzle wiring
  - Better Auth tables via CLI generator; **text** user IDs everywhere
  - baseline tables: profiles, orgs/members, billing customers/subscriptions, webhook ledger, assets
- **Blog/SEO**
  - MDX content pipeline + blog routes + RSS
  - robots/sitemap, OG/Twitter defaults + per-post, JSON-LD helpers
- **Billing/Storage**
  - Dodo checkout/portal/webhook; signature + idempotency + async reconciliation hooks
  - GCS signed URLs; canonical object keys; ownership checks; assets table
- **Security/Observability/Jobs**
  - proxy-based route protection + headers + CSP
  - rate limiting + api auth for external routes
  - logger + requestId correlation; optional sentry/otel scaffolds; optional jobs driver
- **Docs**
  - root docs + per-subsystem READMEs; marker-based regeneration

---

## Timeboxing notes (to hit 7 days)

- Prefer **working, gated** module stubs over perfect polish: activation boundaries + routes gating are the hard requirements.
- Keep v1 generators to a constrained set of templates + a small set of safe AST transforms (only for “index/wiring” files).
- Keep tests minimal but present; allow `doctor` to warn on incomplete coverage unless `strict` profile is enabled.

