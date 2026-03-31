# PRD — 0xstack Starter System (CLI + Modules + Generators)

## Summary
0xstack is an **opinionated starter system** that generates and maintains a consistent production-ready architecture for Next.js apps built on **Supabase Postgres + Drizzle ORM**, using a **tiered architecture**:

- **DB** (Supabase Postgres)
- **Drizzle schema + repos**
- **Service layer** (business logic + permissions)
- **Two entrypoints**
  - **External API**: stable HTTP routes for external clients/apps
  - **Internal server actions**: for RSC-first UI
- **Client hooks**: TanStack Query hooks + canonical query keys
- **RSC UI**: RSC-first UI + shadcn UI preinstalled

The product is not “a repo template”. It’s a **factory**:

- `npx 0xstack init` scaffolds an app based on choices (auth, DB, API style, billing, etc.)
- `npx 0xstack generate <domain>` adds a new domain module end-to-end (schema → repo → service → api/actions → hooks → UI stubs)
- `npx 0xstack doctor` verifies conventions, env, and architecture constraints

## Goals / Non-goals

### Goals
- **Fast start**: Create a new project with your architecture in minutes.
- **Consistency**: Enforce folder layout, naming conventions, and contracts.
- **No hardcoding**: Auth/DB/API choices are selected at init time and abstracted behind interfaces.
- **Extensible**: Add “modules” (billing, multi-tenant orgs, AI, storage, SEO) as composable units.
- **Maintainable output**: Generated code is readable, typed, and hand-editable.
- **RSC-first**: Server components load initial data; client components handle interactivity via hooks.

### Non-goals
- Be a general-purpose framework replacing Next.js.
- Generate every UI screen in full fidelity (initially stubs + layout/wireframes only).
- Support every database/ORM combination in v1 (Supabase + Drizzle is the default path).

## Target user
- Solo devs/founders building repeated Next.js products with Supabase + Drizzle.
- Teams wanting a consistent internal standard for service/repository boundaries and query key conventions.

## User stories
- As a developer, I can run `init` and get a working app with auth pages, app shell, shadcn UI, Drizzle connected to Supabase, and the architecture folders created.
- As a developer, I can run `generate org` and get a complete **org** domain across schema/repos/loaders/rules/actions (plus optional API + hooks), with consistent naming and minimal manual wiring.
- As a developer, I can expose an endpoint for external clients without duplicating business logic already used by server actions.
- As a developer, I can run `doctor` to detect violations (API calling repo directly, missing query keys, env mismatch, missing migrations, etc.).
- As a developer, I get “enterprise-grade SEO” out of the box: metadata defaults, canonical URLs, Open Graph/Twitter, JSON-LD, robots, sitemap(s), and a blog that ships content via MDX.
- As a developer, I can accept payments via **Dodo Payments** (checkout + customer portal + webhooks) and keep billing state in sync with my DB.
- As a developer, I can store and serve user-generated files via **Google Cloud Storage** using signed URLs, without proxying large uploads through my server.
- As a developer, I can enable **Email (Resend)** and get production-grade auth emails (verify-email + reset-password) with real templates and dark-friendly styling.
- As a developer, I can enable a **PWA module** (manifest + service worker + offline + push foundations) so the app is installable and resilient with enterprise-grade caching and notification infrastructure.
- As a developer, I have **central caching infrastructure** (L1 LRU + Next.js Data Cache + tag-based revalidation) so RSC read paths are fast and deduped, and mutations invalidate precisely.

## Product scope

### CLI commands (v1)
#### `npx 0xstack init`
Creates a new project folder (or initializes current folder) with:
- Next.js app router (TypeScript)
- shadcn UI installed and preconfigured
- Supabase + Drizzle wiring
- Auth: **Better Auth only** (no other auth providers in scope)
- Auth pages: `login`, `get-started` (and optional `register`)
- Routes: **no route groups** (no `(marketing)` / `(auth)` / `(app)` segments). Keep routes explicit and simple.
- Base providers: TanStack Query provider, **Theme provider + theme toggle** (must-have)
- Shell: **Header + Footer** (marketing) and **AppShell layout** (authenticated)
- Env schema + validation (e.g. `zod`) and `.env.example`
- Initial “core” domain (must-have): `orgs` (multi-tenant baseline)
- Blog (MDX): blog index + blog post route + content loader + sitemap inclusion
- SEO defaults: `app/robots.ts`, `app/sitemap.ts`, OG/Twitter defaults, JSON-LD utilities
- Billing: Dodo Payments wiring (API routes + webhook receiver + DB tables)
- Storage: Google Cloud Storage wiring (signed upload/download URLs + bucket layout + permissions)
- Email: Resend wiring (provider + templates + Better Auth hooks for verification + reset password)
- PWA: manifest + service worker + offline page + push notification foundations (config-gated)
- Cache: `lib/cache/*` (L1 LRU + `unstable_cache` + `revalidateTag` helpers), plus conventions for tags + TTLs.
- Docs: `README.md` files in each `lib/*` subsystem folder (see Docs requirements)

#### Progressive activation model (must-have)
0xstack must support **progressive activation** so projects don’t feel “executionally suicidal”.

Principle:
- **Installed ≠ Activated**

Rules:
- `init` may install baseline capabilities, but **must keep modules dormant** unless enabled in `0xstack.config.*`.
- `baseline` (and profiles) are what flip modules “on”.
- Runtime code must be **lazy + config-aware**:
  - Use factories like `getBillingService()`, `getStorageService()`, `getSeoConfig()` that:
    - read config
    - throw a clear “module not enabled” error when disabled
    - avoid importing heavy SDKs when disabled (where practical)

Activation boundaries (must-have):
- **Route-level gating**: do not expose/ship route handlers for disabled modules.
- **Import-level gating**: prefer dynamic imports for heavy modules:
  - if disabled, do not import at module top-level
- **Type-level gating (advanced, recommended)**:
  - provide patterns/types so disabled modules do not leak types into enabled surfaces.

Required command semantics:
- **`init`**:
  - creates the skeleton + conventions + config file
  - enables only the “core” (auth + orgs + UI foundation + env + db wiring)
  - does not expose external billing/storage/blog routes unless enabled
- **`baseline`**:
  - installs and activates modules according to a profile or explicit flags

Profiles:
- Support `--profile=<name>`:
  - `npx 0xstack baseline --profile=full` (everything on)
  - `npx 0xstack baseline --profile=core` (auth+orgs only)
  - Profiles are just config presets applied to `0xstack.config.*`.

#### CLI wrapping policy (must-have)
0xstack must **wrap and orchestrate upstream CLIs** required by the stack, instead of re-implementing their behavior.

Goals:
- Keep 0xstack as the **orchestrator**: apply conventions, wire files, and run vendor CLIs in the right order.
- Preserve the ability to run vendor CLIs directly when needed.

Required wrapped CLIs (baseline):
- **shadcn**: component install/add + `components.json` management.
- **Better Auth CLI**: schema generation (e.g. `npx auth@latest generate`) for Better Auth tables/relations.
- **drizzle-kit**: migrations (`generate`, `migrate`) and introspection where used.

Wrapper requirements:
- **Passthrough**: provide a way to forward raw args to the underlying CLI, e.g.:
  - `npx 0xstack shadcn ...`
  - `npx 0xstack auth ...`
  - `npx 0xstack drizzle ...`
- **Non-interactive by default**: wrappers should prefer deterministic flags. If upstream requires prompts, 0xstack must either:
  - surface the prompt cleanly, or
  - provide equivalent flags/presets.
- **Auditability**: each wrapper run should print:
  - the exact underlying command executed
  - versions resolved (where possible)
  - files it modified (best-effort)
- **Idempotency**: rerunning wrappers should not duplicate config or corrupt files.

#### CLI architecture (enterprise) (must-have)
0xstack is simultaneously:
- **Scaffolder**: `init`, `generate`
- **Orchestrator**: wraps vendor CLIs
- **Project operator**: docs, hygiene, git/release automation

These concerns must be separated in the CLI codebase so it remains maintainable.

Recommended CLI code structure:

```txt
packages/
  cli/
    commands/
      init.ts
      generate.ts
      add.ts
      baseline.ts
      doctor.ts
      sync.ts
      docs.ts
      git.ts
      release.ts
    core/
      runner.ts
      logger.ts
      config.ts
    wrappers/
      shadcn.ts
      drizzle.ts
      auth.ts
    generators/
      domain.ts
      module.ts
    utils/
      exec.ts
      fs.ts
```

#### CLI UX (must-have)
The CLI must feel modern and ergonomic.

Requirements:
- Clean, progressive logs (step-by-step, no spam)
- Spinners for long-running operations
- Clear errors with remediation steps
- Supports non-interactive flags; prompts only when required

Recommended tooling:
- command parser: `cac` (preferred) or `commander`
- colors: `chalk` or `kleur`
- spinners: `ora`
- prompts: `prompts`
- process runner: `execa`

#### Operator commands (enterprise) (must-have)
0xstack must provide “operator” commands that keep projects consistent over time.

#### Deterministic execution engine (must-have)
All CLI commands that touch multiple systems (deps, schema, routes, docs, lint) must execute through a deterministic pipeline engine.

Requirements:
- A command is a **pipeline** composed of named steps.
- Each step must be:
  - logged (start/end + duration)
  - retryable
  - skippable (when already satisfied)
  - idempotent-aware
- Failures must surface:
  - which step failed
  - the underlying command (if any)
  - remediation guidance

Conceptual shape:

```ts
await runPipeline([
  step("validate config"),
  step("install deps"),
  step("generate auth schema"),
  step("run drizzle migrations"),
  step("sync docs"),
])
```

##### `npx 0xstack sync`
Auto-heal the repo based on `0xstack.config.*`:
- validate config + env schema
- re-run schema/type generation steps that are safe to re-run
- regenerate docs (`PRD.md`, `ERD.md`, `ARCHITECTURE.md`) in auto-generated sections
- align deps with enabled modules (add missing; warn on unused)
- format/lint (if configured)

Reconciliation requirements (must-have):
- `sync` is the platform garbage collector; it must reconcile:
  - config ↔ installed deps ↔ activated routes ↔ docs
  - schema drift (detect missing migrations / mismatched generated schema)
  - unused modules (warn, and optionally offer removal)
- `sync` must never silently delete code; it may generate a plan/diff and require a flag to apply destructive changes.

##### `npx 0xstack docs sync`
Regenerate documentation safely using markers:

- Must use stable markers like:
  - `<!-- AUTO-GENERATED START -->`
  - `<!-- AUTO-GENERATED END -->`
- Must never clobber user-authored text outside markers.

#### Git automation namespace (optional but recommended)
Provide a `git` command namespace that shells out to git (do not implement a “git engine”).

##### `npx 0xstack git init`
- initialize repo + add baseline `.gitignore`

##### `npx 0xstack git commit`
- prompt-based commit message builder:
  - type: `feat`/`fix`/`chore`/`refactor`
  - scope: `orgs`/`billing`/`auth`/etc.
  - message: short description
- output: a standardized message, optionally with emoji mapping (configurable)

#### Release automation (optional)
Provide `npx 0xstack release` for versioning and tagging.

Preferred:
- `changesets` for monorepos

Minimum behaviors:
- detect changes
- bump semver (feat→minor, fix→patch, breaking→major)
- update changelog
- commit + tag

#### Templates & transforms (must-have)
Generators must use:
- file templates for initial scaffolding
- AST transforms for updates to existing TS/TSX files

Recommended tooling:
- `ts-morph` for TypeScript AST transforms

#### Configuration & presets (enterprise) (must-have)
0xstack must support a repo-local configuration file to define what is **enforced** vs **customizable**.

- **Config file**: `0xstack.config.ts` (preferred) or `0xstack.config.json`
- **Purpose**: declare modules, domains, and conventions so `baseline`, `doctor`, and generators are deterministic.

Minimum config schema:
- **`profiles`** (must-have):
  - named presets that set `modules` + conventions (e.g. `full`, `core`, `saas`, `content`)
- **`app`**:
  - `name`, `description`, `baseUrl` (used for SEO canonicals/sitemaps)
  - `envMode`: `strict` (default) | `warn`
- **`modules`**:
  - `auth: "better-auth"` (fixed in v1)
  - `billing: "dodo" | false`
  - `storage: "gcs" | false`
  - `seo: true | false`
  - `blogMdx: true | false`
  - `observability: { sentry: true|false, otel: true|false }`
  - `jobs: { enabled: true|false, driver: "inngest" | "cron-only" }`
- **`conventions`**:
  - `routesBase`: `"app"` (fixed)
  - `dashboardPrefix`: `"/app"` (default; allow override like `"/dashboard"`)
  - `idStrategy`: `"text"` (required for Better Auth compatibility)

Doctor requirements:
- `doctor` must read `0xstack.config.*` and validate:
  - config schema
  - installed deps match enabled modules (see Baseline dependencies)
  - required files exist for enabled modules

#### Strong config typing + defaults (must-have)
The config system must be typed, validated, and defaulted.

Requirements:
- Provide a `defineConfig()` helper that:
  - validates via Zod
  - applies defaults
  - exports a fully-typed config object for the rest of the system
- Config must be the single source of truth for:
  - module activation
  - conventions (dashboard prefix, id strategy)
  - docs inventory

Example shape:

```ts
export default defineConfig({
  app: { name: "MyApp", baseUrl: "https://example.com" },
  modules: {
    billing: false,
    storage: false,
    seo: true,
    blogMdx: false,
  },
})
```

Prompts (initial set):
- App type: SaaS / AI tool / Marketplace / Minimal
- DB: Supabase (required in v1) + URL style (pooled vs direct)
- Entry points (fixed):
  - **Internal app** uses **server actions** for all DB operations
  - **External clients** use **HTTP API routes** (stable contract)
- Billing: **Dodo Payments / none**
- Multi-tenancy: on/off (orgs)
- UI: shadcn + theme (light/dark) on/off

#### `npx 0xstack generate <domain>`
Adds a domain module with consistent wiring.

Inputs:
- Domain name (e.g. `org`, `material`, `generation`)
- Primary ID style: `uuid` (default) / `cuid2` / `nanoId`
- Ownership model: user-owned / org-owned
- CRUD shape: create/read/update/delete (selectable)
- Exposure (fixed):
  - **Always** generate **server actions** for internal use
  - **Optional** generate **API routes** for external use (toggle on/off)

Outputs (typical):
- Drizzle schema additions in `lib/db/schema.ts` + inferred types
- Repo: `lib/repos/<domain>.repo.ts`
- Loader: `lib/loaders/<domain>.loader.ts` (read facade, `React.cache()`)
- Rules: `lib/rules/<domain>.rules.ts` (write rules)
- Service (optional): `lib/services/<domain>.service.ts` (orchestration only)
- Validation: `zod` schemas for inputs
- API routes: `app/api/<plural>/route.ts` (optional)
- Server actions: `lib/actions/<domain>.actions.ts` (optional)
- Query keys: `lib/query-keys/<domain>.keys.ts`
- Mutation keys: `lib/mutation-keys/<domain>.mutations.ts`
- Client hooks: `lib/hooks/client/use-<domain>.client.ts`
- UI stubs: list/detail/create components + route placeholders
- Tests (optional in v1, required in v2)

#### `npx 0xstack add <module>`
Installs a feature module and wires config:
- `billing-dodo`
- `orgs` (multi-tenant baseline)
- `ai-openai` / `ai-gemini` (future)
- `storage-gcs`

#### Module lifecycle contract (must-have)
Modules must implement a consistent lifecycle so activation is predictable and testable.

Required interface (conceptual):

```ts
interface Module {
  id: string
  install(): Promise<void>   // deps + files + schema stubs
  activate(): Promise<void>  // routes + config flips
  validate(): Promise<void>  // env + required secrets + invariants
  sync(): Promise<void>      // reconcile + docs + hygiene
}
```

Rules:
- `baseline` orchestrates `install → activate → validate → sync` through the pipeline engine.
- `doctor` must call `validate()` logic (or equivalent checks) for enabled modules.

#### `npx 0xstack baseline`
Installs the **full 0xstack baseline** in one command (idempotent).

This is the “stop rebuilding it every time” command. It must:
- Add/ensure **all baseline folders/files**, including:
  - UI foundation (theme provider + toggle, header/footer, AppShell)
  - Baseline schema tables (auth/profile/org/billing/webhooks/assets)
  - Dodo billing routes + webhook receiver (plug-and-play)
  - GCS storage helpers (signed URL generation)
  - Blog (MDX) loader + routes
  - SEO (robots/sitemap/JSON-LD helpers)
- Generate/refresh **project-level docs**:
  - `PRD.md`
  - `ERD.md`
  - `ARCHITECTURE.md`
- Install required dependencies and scripts.
- Generate/refresh `README.md` for each `lib/*` subsystem directory.
- Be safe to re-run: it should either merge cleanly or refuse with actionable guidance.

Activation requirements:
- `baseline` must respect `0xstack.config.*` and only **activate** what is enabled.
- It may still **install** deps for disabled modules (if using an “everything installed” posture), but must:
  - keep code paths dormant
  - avoid routing surface area for disabled modules
  - avoid runtime imports for disabled modules where practical

#### `npx 0xstack doctor`
Validates:
- Env vars present and correct format
- Drizzle migrations state
- Folder conventions exist
- Architecture constraints (no repo called directly from UI/API outside allowed cases)
- Query key conventions
- Enterprise baselines enabled in config:
  - security headers present
  - API auth + rate limit guards present
  - observability hooks present (if enabled)
  - jobs endpoints present (if enabled)

#### `npx 0xstack upgrade` (stretch)
Applies codemods for newer conventions.

## Architecture spec (what generated code must follow)

### Contracts and boundaries
0xstack standardizes **two highways**:

- **Read highway (fast)**: `RSC Page → Loader → Repo → DB`
  - No services. No client hooks. No business logic.
  - Loaders shape responses for viewer/public projections and return page-ready DTOs.
- **Write highway (safe)**: `Client UI → Server Action → Rules → (Service) → Repo → DB`
  - Actions are the only internal entry point for DB writes.
  - Rules own authorization + invariants; services are optional and only for orchestration.

Layer definitions:
- **Repos**: data access only (read + write queries), no business logic.
- **Loaders**: read-only facades; use `React.cache()`; shape output based on viewer/context.
- **Rules**: business rules for writes (authz + invariants + validation glue).
- **Services**: orchestration only (multi-step flows, transactions across repos, integrations like billing/storage).
- **Server actions**: internal API for the app; must call `requireAuth()` for authenticated operations; validate with Zod; call rules/services/repos; trigger cache revalidation.
- **API routes**: external only (webhooks, auth handler, cron, integrations); call the same rules/services as actions.
- **Client hooks**: transport + cache only (TanStack Query). No business logic.
- **Zustand**: UI/transient-only state.

### Boundary enforcement (must-have)
Architecture must be enforced mechanically (not vibes).

Required enforcement layers:
- **ESLint import restrictions** (baseline):
  - prevent UI and route handlers from importing low-level layers directly.
  - Example rule (conceptual):

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          { "group": ["@/lib/repos/*"], "message": "Use loaders/actions instead." },
          { "group": ["@/lib/db/*"], "message": "Use repos instead." }
        ]
      }
    ]
  }
}
```

- **Doctor static checks**:
  - verify restricted import patterns across `app/**` and client components
  - verify `lib/loaders/**` do not import `lib/rules/**` (read path purity)
  - verify `lib/repos/**` do not import `lib/loaders/**` or UI code

### Folder layout (generated default — **flat**, no `src/`)
Rule: **app router stays in `app/`** (Next.js), everything else lives in **`lib/`**.  
No “grouping by layer at repo root” (no `services/`, `hooks/`, etc. at top-level) — it all goes under `lib/`.

```txt
.
├─ app/
│  ├─ layout.tsx
│  ├─ globals.css
│  ├─ page.tsx                          # marketing home
│  ├─ about/page.tsx
│  ├─ contact/page.tsx
│  ├─ pricing/page.tsx
│  ├─ blog/page.tsx                     # blog index
│  ├─ blog/[slug]/page.tsx              # blog post
│  ├─ login/page.tsx
│  ├─ register/page.tsx                 # optional
│  ├─ forgot-password/page.tsx          # optional
│  ├─ reset-password/page.tsx           # optional
│  ├─ get-started/page.tsx
│  ├─ logout/page.tsx                   # optional
│  ├─ terms/page.tsx                    # legal
│  ├─ privacy/page.tsx                  # legal
│  ├─ cookies/page.tsx                  # legal (optional)
│  ├─ refund/page.tsx                   # legal (optional; needed for billing)
│  ├─ security/page.tsx                 # trust surface (optional)
│  ├─ app/layout.tsx                    # authenticated shell (simple, explicit)
│  ├─ app/page.tsx                      # app landing
│  ├─ app/orgs/page.tsx                 # example domain list
│  ├─ app/orgs/[orgSlug]/page.tsx
│  └─ ...                               # other pages
│  └─ api/
│     ├─ health/route.ts
│     ├─ auth/[...all]/route.ts         # Better Auth handler
│     └─ v1/
│        ├─ orgs/route.ts
│        ├─ billing/checkout/route.ts
│        ├─ billing/portal/route.ts
│        ├─ billing/webhook/route.ts
│        └─ ...                         # external API surface
│
├─ app/robots.ts                         # robots.txt (generated)
├─ app/sitemap.ts                        # sitemap.xml (generated)
├─ app/rss.xml/route.ts                  # RSS feed (blog)
│
├─ lib/
│  ├─ actions/
│  │  ├─ orgs.actions.ts
│  │  ├─ materials.actions.ts
│  │  ├─ billing.actions.ts              # internal helpers (optional)
│  │  └─ ...                            # server actions (internal entrypoint)
│  ├─ api/
│  │  ├─ http.ts                        # fetch wrappers for client (if needed)
│  │  └─ routes.ts                      # typed route helpers (optional)
│  ├─ auth/
│  │  ├─ better-auth.ts                  # betterAuth() config (Drizzle adapter)
│  │  ├─ auth-client.ts                  # createAuthClient + inferred types
│  │  └─ server.ts                       # getViewer/requireAuth (React.cache())
│  ├─ components/
│  │  ├─ ui/                            # shadcn components
│  │  └─ <feature>/                     # feature components (thin/dumb)
│  ├─ db/
│  │  ├─ index.ts                        # drizzle client init/export
│  │  └─ schema.ts                       # ⭐ single schema file (ALL tables)
│  ├─ repos/
│  │  ├─ orgs.repo.ts
│  │  ├─ materials.repo.ts
│  │  ├─ billing.repo.ts
│  │  ├─ webhooks.repo.ts               # webhook idempotency ledger
│  │  └─ ...
│  ├─ loaders/
│  │  ├─ orgs.loader.ts
│  │  ├─ materials.loader.ts
│  │  ├─ blog.loader.ts
│  │  └─ ...
│  ├─ rules/
│  │  ├─ orgs.rules.ts
│  │  ├─ materials.rules.ts
│  │  ├─ billing.rules.ts
│  │  └─ ...
│  ├─ services/
│  │  ├─ billing.service.ts             # Dodo webhook processing + sync
│  │  ├─ storage.service.ts             # GCS orchestration (variants optional)
│  │  └─ ...                            # orchestration only
│  ├─ query-keys/
│  │  ├─ index.ts
│  │  ├─ orgs.keys.ts
│  │  ├─ materials.keys.ts
│  │  └─ ...
│  ├─ mutation-keys/
│  │  ├─ index.ts
│  │  ├─ orgs.mutations.ts
│  │  └─ ...
│  ├─ env/
│  │  ├─ schema.ts                      # zod env schema
│  │  └─ server.ts                      # validated server env export
│  ├─ seo/
│  │  ├─ metadata.ts                    # defaults (metadataBase, OG, twitter)
│  │  ├─ jsonld.ts                      # helpers to render JSON-LD safely
│  │  ├─ sitemap.ts                     # helpers to build sitemap entries
│  │  └─ robots.ts                      # helpers for robots rules
│  ├─ content/
│  │  ├─ mdx.ts                         # MDX compilation/render helpers
│  │  └─ frontmatter.ts                 # frontmatter parsing/validation
│  ├─ storage/
│  │  ├─ gcs.ts                         # low-level signed URL helpers
│  │  └─ paths.ts                       # canonical object key builder
│  ├─ billing/
│  │  ├─ dodo.ts                        # low-level Dodo client helpers
│  │  └─ dodo.webhooks.ts               # parsing + signature verification helpers
│  ├─ stores/
│  │  ├─ ui.store.ts                    # Zustand UI-only state
│  │  └─ ...
│  ├─ hooks/
│  │  └─ client/
│  │     ├─ use-orgs.client.ts
│  │     ├─ use-materials.client.ts
│  │     └─ ...
│  ├─ styles/
│  │  └─ tokens.css                     # optional future extension
│  ├─ utils/
│  │  ├─ errors.ts
│  │  ├─ ids.ts
│  │  └─ permissions.ts
│  └─ validators/
│     ├─ orgs.validators.ts
│     └─ ...
│
├─ drizzle/
│  ├─ migrations/
│  └─ snapshots/
│
├─ public/
├─ content/
│  └─ blog/
│     ├─ hello-world.mdx
│     └─ ...                            # blog posts live here
├─ components.json                      # shadcn config
├─ drizzle.config.ts
├─ proxy.ts                             # Next.js 16 request proxy (route protection + headers)
├─ next.config.ts
├─ postcss.config.mjs
├─ tailwind.config.ts
├─ package.json
├─ .env.example
└─ README.md
```

### Naming conventions
- Tables: `<plural>` (e.g. `orgs`, `materials`)
- Schema: `lib/db/schema.ts` is the single source of truth (tables + enums).
- Repo: `lib/repos/{domain}.repo.ts`
- Loader: `lib/loaders/{domain}.loader.ts`
- Rules: `lib/rules/{domain}.rules.ts`
- Action: `lib/actions/{domain}.actions.ts`
- Service (optional): `lib/services/{domain}.service.ts` (or `billing.service.ts`, `storage.service.ts`)
- Query keys: `lib/query-keys/{domain}.keys.ts` (tuple keys)
- Mutation keys: `lib/mutation-keys/{domain}.mutations.ts`
- Client hooks: `lib/hooks/client/use-{domain}.client.ts`
- API routes: plural, stable, versioning optional:
  - `app/api/v1/orgs/route.ts` (optional)

## Configuration & “not hardcoded” strategy

### Adapter interfaces (core)
Generated core defines interfaces, implementations live in adapters.

Required interfaces (v1):
- `AuthProvider`: `getSession(headers)`, `requireUser(headers)`
- `DbProvider`: exposes Drizzle client configured via env
- Optional: `BillingProvider` (Dodo Payments), `AiProvider` (future)

### Dependency injection pattern
- Services import **interfaces** and receive concrete adapters via:
  - module-level `getXxxService()` factory, or
  - explicit parameters in server actions/routes

Constraints:
- No service should import vendor SDKs directly; vendor code belongs in dedicated integration modules (e.g. `lib/auth/*`, `lib/billing/*`, `lib/storage/*`).

## Functional requirements

### Init (must-have)
- Generates runnable Next.js app with:
  - `/` marketing page
  - `/login` auth page
  - `/get-started` onboarding page
  - `/app` authenticated area with layout shell
- Generates standard marketing + legal pages:
  - `/about`
  - `/contact`
  - `/pricing`
  - `/terms`
  - `/privacy`
  - `/cookies` (optional)
  - `/refund` (optional; required if billing enabled)
  - `/security` (optional trust page)
- shadcn installed and at least:
  - `Button`, `Input`, `Card`, `Dialog`, `DropdownMenu`, `Toast` (or `Sonner`)
- Drizzle configured with:
  - `lib/db/schema.ts` (single schema file) + example tables (auth/profile/billing baseline)
  - migration scripts
- TanStack Query configured with provider and example hook.

### Auth (must-have)
- Generated app must use **Better Auth only**.
- The service/action/api layers must derive the actor (`userId`) from Better Auth session.
- `doctor` must verify Better Auth env variables exist (see Env section).
 - **ID type requirement**: Better Auth user IDs are **text**. Treat `user.id` as `string` everywhere.
  - DB tables referencing users must use `text`/`varchar` FK columns (not UUID).
  - No codegen may assume `uuid` for `userId`.

### External API vs internal actions (must-have)
- **Internal UI** must perform DB operations only via **server actions** in `lib/actions/*`.
- **External usage** must go through `app/api/**/route.ts` and must call the same services used by actions.
- `doctor` must flag:
  - UI code importing repos directly
  - API routes importing repos directly

### Security baseline (enterprise) (must-have)
0xstack must ship an opinionated security posture suitable for production.

#### Central security subsystem (must-have)
Security logic must be centralized to avoid copy-paste drift.

Required structure:

```txt
lib/security/
  headers.ts
  csp.ts
  rate-limit.ts
  api-auth.ts
  request-id.ts
```

Rules:
- `proxy.ts` and API routes must call into `lib/security/*` rather than re-implementing logic.
- `doctor` must verify these entry points are used (best-effort static checks).

#### Request proxy / route protection (must-have)
- The baseline must generate `proxy.ts` at repo root (Next.js 16 request proxy; replaces prior `middleware.ts` usage in this stack).
- Responsibilities:
  - **Route protection**:
    - Protect authenticated routes under the configured dashboard prefix (default: `/app/*`).
    - Redirect unauthenticated users to `/login?redirect=<path>`.
    - Redirect authenticated users away from auth routes where appropriate (e.g. `/login` → `/app`).
  - **Security headers**:
    - Attach the baseline HTTP security headers and CSP (as defined below), or delegate to Next config where applicable.
  - **Request ID propagation**:
    - Generate `x-request-id` if missing and propagate it to downstream responses.

#### HTTP security headers (must-have)
- Provide a baseline header policy in `next.config.ts` (or middleware where needed) including, at minimum:
  - `Strict-Transport-Security` (prod only)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Permissions-Policy` (deny by default, enable explicitly)
  - `X-Frame-Options` or CSP `frame-ancestors` (prefer CSP)
- Header policy must be documented in `ARCHITECTURE.md` and enforced by `doctor`.

#### Content Security Policy (CSP) (must-have)
- Generate a baseline CSP that supports:
  - Better Auth (auth endpoints + OAuth redirects)
  - Dodo checkout (if billing enabled) and webhook endpoints
  - Next.js `next/image` and fonts
- CSP should be:
  - strict by default (`default-src 'self'`)
  - extensible via config (`0xstack.config.ts`)
- `doctor` must verify a CSP exists and is not trivially permissive (e.g. `*` everywhere).

#### Webhook hardening (must-have)
- Webhook routes must:
  - verify signature (raw body)
  - implement idempotency ledger writes before processing
  - ACK fast; reconcile async (jobs/after pattern)
- `doctor` must verify webhook routes reference the ledger and verification helpers.

#### Secrets & environments (must-have)
- `.env.example` must include all required vars for enabled modules.
- Document recommended secret storage (Vercel/Cloud Run/Secret Manager) in `ARCHITECTURE.md`.

### API baseline (enterprise) (must-have)
External API routes under `app/api/v1/*` must follow consistent contracts.

#### Auth strategy (must-have)
- Choose one baseline for external API auth (configurable):
  - **API key**: `Authorization: Bearer <key>` or `X-API-Key`
  - Optional: attribution header (for public APIs)
- Internal UI must not use API keys; it uses cookies + server actions.

#### Rate limiting (must-have)
- Add a baseline rate limit guard for all `app/api/v1/*` routes (configurable limits).
- Must include burst + sustained limits and return 429 with retry info.

#### Request IDs + tracing (must-have)
- Every API response must include:
  - `x-request-id`
- Request ID must be generated at the edge of the request and propagated through logs.

#### Error envelope (must-have)
- Standardize an error response shape for API routes:
  - `code`, `message`, `requestId`, `details` (optional)
- `doctor` must verify API routes return the standardized envelope for non-2xx responses (best-effort static checks).

### Observability baseline (enterprise) (must-have)
0xstack must provide a consistent observability story.

#### Logging (must-have)
- Provide a structured logger utility in `lib/utils/logger.ts` with:
  - log levels
  - requestId correlation
  - safe redaction (no secrets, tokens, raw webhook secrets)
- Enforce logging for:
  - webhook processing
  - billing reconciliation
  - storage signed URL issuance

#### Sentry (optional module, but enterprise recommended)
- If enabled in config:
  - install and configure `@sentry/nextjs`
  - capture exceptions in webhook routes and background jobs
  - attach requestId + orgId/userId where safe

#### OpenTelemetry (optional module)
- If enabled in config:
  - expose baseline OTEL setup and propagate trace IDs into logs.

### Jobs module (optional but recommended)
Background processing is required for reliable webhook reconciliation and heavy tasks.

If jobs are enabled:
- Provide one of:
  - **Inngest driver** (recommended) for durable background jobs, or
  - **cron-only** endpoints for scheduled reconciliation
- Required job use-cases:
  - process Dodo webhook events asynchronously after ACK
  - periodic reconciliation (e.g., re-sync subscriptions)
- `doctor` must verify job endpoints exist and are not publicly open without auth/secret gating.

### Blog (MDX) (must-have)
- Blog content must be sourced from **local MDX files** at `content/blog/*.mdx`.
- Each post must support frontmatter:
  - `title` (string, required)
  - `description` (string, required)
  - `date` (ISO string, required)
  - `slug` (string, optional if derived from filename)
  - `published` (boolean, default true)
  - `tags` (string[], optional)
  - `image` (string URL/path, optional; used for OG)
- Routes:
  - `app/blog/page.tsx` lists posts (sorted by date, filters unpublished in prod)
  - `app/blog/[slug]/page.tsx` renders the MDX post
- The blog must integrate with:
  - Sitemap (`app/sitemap.ts`)
  - RSS (`app/rss.xml/route.ts`)
  - Per-post metadata and JSON-LD (see SEO)

### SEO (enterprise-grade) (must-have)
Use Next.js App Router conventions (metadata + metadata route files).

- **Site defaults**:
  - Root layout provides consistent defaults via `metadata` export (title template, description, metadataBase, openGraph, twitter, icons).
  - Canonicals must be stable and derived from `metadataBase`.
- **Robots**:
  - Provide `app/robots.ts` generating robots rules and pointing to sitemap (per Next.js `robots.ts` convention).
- **Sitemap**:
  - Provide `app/sitemap.ts` generating a sitemap (per Next.js `sitemap.ts` convention).
  - Must include marketing pages + blog index + blog posts.
  - For larger sites, support splitting via `generateSitemaps` (stretch).
- **Open Graph / Twitter cards**:
  - Provide default OG/Twitter metadata for marketing pages.
  - Provide per-blog-post OG data (title/description/image).
  - Support OG image generation via `opengraph-image.tsx` / `twitter-image.tsx` colocated with routes (recommended), or static images as fallback.
- **JSON-LD structured data**:
  - Provide helpers to render JSON-LD via a native `<script type="application/ld+json">` tag.
  - Must sanitize JSON by replacing `<` with `\\u003c` (per Next.js JSON-LD guidance).
  - Include:
    - Sitewide `Organization` + `WebSite` schema (layout-level)
    - Blog post pages include `Article` schema (page-level)

Recommended references (implementation guidance):
- Next.js `sitemap.ts`/`sitemap.xml`: `https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap`
- Next.js `robots.ts`/`robots.txt`: `https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots`
- Next.js JSON-LD guide: `https://nextjs.org/docs/app/guides/json-ld`
- Next.js OG image file conventions: `https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image`

### Billing (Dodo Payments) (must-have)
- The starter must support:
  - Creating checkout URLs for one-time + subscription purchases
  - Customer portal link generation
  - Webhook receiver endpoint with signature verification
- API routes (external surface):
  - `app/api/v1/billing/checkout/route.ts`
  - `app/api/v1/billing/portal/route.ts`
  - `app/api/v1/billing/webhook/route.ts` (raw body + signature verification)
- Webhook processing requirements:
  - Verify signature using the raw body (do not JSON-parse before verification).
  - Next.js webhook headers to verify:
    - `webhook-id`
    - `webhook-signature`
    - `webhook-timestamp`
  - Recommended verification library: `standardwebhooks` (`Webhook.verify(payload, headers)`), or Dodo’s Next.js adapter.
  - Idempotency: dedupe webhook events by `event_id` (store processed IDs).
  - Exactly-once effects at the DB level using transactions and unique constraints.
- Env vars (baseline, aligned with Dodo docs):
  - `DODO_PAYMENTS_API_KEY`
  - `DODO_PAYMENTS_WEBHOOK_KEY`
  - `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` | `live_mode`)
  - `DODO_PAYMENTS_RETURN_URL`

Plug-and-play integration requirement:
- Provide an implementation option using Dodo’s Next.js adapter:
  - `import { Webhooks } from "@dodopayments/nextjs"; export const POST = Webhooks({ webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY, ...handlers })`
- The baseline must include a `lib/billing/dodo.webhooks.ts` wrapper that:
  - normalizes payloads,
  - persists the webhook ledger row first,
  - acks fast,
  - then dispatches to `lib/services/billing.service.ts` for reconciliation.
- DB state:
  - Store mapping between Better Auth `userId` (string) and Dodo `customer_id`.
  - Store subscription status, plan/product IDs, current period, cancellation state.

### Storage (Google Cloud Storage) (must-have)
- Storage must use **direct-to-GCS uploads** via signed URLs (V4 signing).
- The app must not proxy large uploads through Next.js.
- API route + action requirements:
  - Server action returns a signed upload URL (write) for a constrained object key and content type.
  - Optional signed read URLs for private assets.
- Canonical object keys (example):
  - `users/{userId}/avatars/{assetId}`
  - `orgs/{orgId}/files/{assetId}`
- Security:
  - Signed URLs expire quickly (e.g. 10–15 minutes).
  - Server verifies ownership before issuing URLs.
  - Content-type restriction included in signed URL where supported.
- Env vars (baseline):
  - `GCS_BUCKET`
  - `GCS_PROJECT_ID`
  - `GOOGLE_APPLICATION_CREDENTIALS` (local dev) or workload identity in production

### Env (must-have)
- `init` must generate:
  - `.env.example` containing **all required** variables for the chosen modules
  - `lib/env/schema.ts` (Zod schema) and `lib/env/server.ts` (validated export)
- App must **fail fast** in development if required env vars are missing (clear error).
- `doctor` must check for missing vars and mismatched names.

### UI foundation (theme + shell) (must-have)
- `init` must generate a fully working **UI foundation** that is reused across every app:
  - **Theme provider** + **theme toggle** (light/dark) and persisted preference.
  - **Header** + **Footer** shared across marketing pages.
  - **AppShell** layout for authenticated routes with:
    - top nav
    - optional sidebar slot
    - user menu (login/logout/profile)
- Must include a ready-to-edit `lib/components/layout/*` area for:
  - `SiteHeader`
  - `SiteFooter`
  - `AppHeader`
  - `AppSidebar` (optional)
  - `AppShell`
- Must include a dedicated page for theme/system settings:
  - `app/app/settings/page.tsx` (contains theme toggle and basic profile/billing links)

### Baseline schema (enterprise) (must-have)
The starter must ship a **baseline product schema** in `lib/db/schema.ts` that is sufficient for:
auth, profile, org membership, billing, webhook idempotency, and storage assets.

Hard rules:
- Better Auth `user.id` is **text** (`string`). All FKs to users must be **text/varchar**, never UUID.
- All externally-referenced entities must have stable IDs (typically `text` IDs) and immutable creation timestamps.
- Every webhook pipeline must have a durable **idempotency ledger** enforced by a unique constraint.

Better Auth core schema requirements (must-have):
- Better Auth requires a **core database schema** covering (at minimum) the following tables:
  - `user`
  - `session`
  - `account`
  - `verification`
- 0xstack must not “hand-roll” these tables. It must:
  - run the Better Auth CLI schema generator (`npx auth@latest generate`) and
  - integrate the generated Drizzle schema into the app’s Drizzle schema exports.
- Compatibility requirement with “single schema file” convention:
  - `lib/db/schema.ts` remains the canonical export surface, but may re-export tables defined in other files generated by the Better Auth CLI (merge-friendly).
  - If table names are customized (pluralization, renamed columns), the Better Auth Drizzle adapter must be configured accordingly (mapping via adapter `schema`/`usePlural` or auth config `modelName`/`fields`).

Minimum required entities (conceptual; exact column names are implementation-defined but the semantics are not optional):
- **auth**: Better Auth tables (generated via Better Auth CLI + Drizzle adapter).
- **user_profiles**:
  - `user_id` (PK/FK to auth user.id, text), `display_name`, `avatar_asset_id`, `created_at`, `updated_at`
- **orgs**:
  - `id` (text), `slug` (unique), `name`, `created_by_user_id` (text), `created_at`, `updated_at`
- **org_members**:
  - `org_id` (text), `user_id` (text), `role` (`owner`|`admin`|`member`), `created_at`
  - unique (`org_id`, `user_id`)
- **billing_customers** (Dodo mapping):
  - `user_id` (text), `dodo_customer_id` (unique), `created_at`
- **billing_subscriptions**:
  - `org_id` (text), `provider` (`dodo`), `provider_subscription_id` (unique), `status`, `plan_id`, `current_period_end`, `cancel_at_period_end`, `created_at`, `updated_at`
- **webhook_events** (idempotency ledger):
  - `provider` (`dodo`), `event_id` (unique), `event_type`, `payload_json`, `received_at`, `processed_at`, `processing_error`
- **assets** (storage index):
  - `id` (text), `owner_user_id` (text, nullable), `org_id` (text, nullable), `bucket`, `object_key`, `content_type`, `size_bytes`, `sha256`, `created_at`

Org naming requirement:
- The domain is **org** everywhere (not workspace). Public routing uses `orgSlug` where appropriate.

### Docs requirements (must-have)
- Every first-class `lib/*` subsystem folder must contain a `README.md` generated/maintained by 0xstack.
- Minimum `README.md` sections (per folder):
  - **Purpose** (what this subsystem owns)
  - **Allowed imports** (what it can/can’t import)
  - **Entry points** (key functions/files)
  - **Conventions** (naming + patterns)
  - **Examples** (1–2 minimal examples)

Required `README.md` locations (baseline):
- `lib/actions/README.md`
- `lib/auth/README.md`
- `lib/billing/README.md`
- `lib/content/README.md`
- `lib/db/README.md`
- `lib/env/README.md`
- `lib/hooks/README.md` and `lib/hooks/client/README.md`
- `lib/loaders/README.md`
- `lib/mutation-keys/README.md`
- `lib/query-keys/README.md`
- `lib/repos/README.md`
- `lib/rules/README.md`
- `lib/seo/README.md`
- `lib/services/README.md`
- `lib/storage/README.md`
- `lib/stores/README.md`

### Project docs (must-have)
0xstack must generate and maintain the following files at repo root:

- `PRD.md`
- `ERD.md`
- `ARCHITECTURE.md`

Rules:
- Generated by `0xstack baseline` and updated by domain/module installs.
- Must include a **current inventory** of installed domains/modules and their entry points (API routes, actions, loaders, repos).
- Must preserve user edits by using merge-friendly stable sections/markers.

Minimum content requirements:
- **`PRD.md`**:
  - baseline product shell + non-functional requirements
  - “Modules installed” section (auth/billing/storage/seo/blog)
  - “Domains installed” section (orgs, materials, etc.)
- **`ERD.md`**:
  - baseline ERD covering, at minimum:
    - Better Auth tables → `user_profiles` (1:1)
    - `orgs` ↔ `org_members` ↔ users (M:N)
    - users → `billing_customers` (1:1)
    - orgs → `billing_subscriptions` (1:N)
    - `webhook_events` idempotency ledger (provider + event_id unique)
    - users/orgs → `assets` (1:N)
  - table index list (one line per table with purpose)
- **`ARCHITECTURE.md`**:
  - “two highways” (read vs write)
  - boundaries and allowed imports
  - integrations: Better Auth, Dodo Payments, GCS, SEO surfaces

#### Docs as derived truth (must-have)
Docs must be derived from the system state, not treated as hand-maintained snapshots.

Requirements:
- `ERD.md` is derived from:
  - Drizzle schema exports + relations (and/or migration snapshots)
- module inventory is derived from:
  - `0xstack.config.*` + detected entry points
- routes inventory is derived from:
  - `app/api/**` tree (and activated modules)
- domains inventory is derived from:
  - presence of `{domain}.repo.ts` + `{domain}.loader.ts` + `{domain}.actions.ts`

`docs sync` must regenerate only auto-generated sections using stable markers.

### Global CSS (must-have)
- `init` must create `app/globals.css` with the exact baseline below (can append additional shadcn-required layers, but must not remove/rename tokens):

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.9900 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(0.9900 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0 0 0);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.9400 0 0);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0.9700 0 0);
  --muted-foreground: oklch(0.4400 0 0);
  --accent: oklch(0.9400 0 0);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0.6300 0.1900 23.0300);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.9200 0 0);
  --input: oklch(0.9400 0 0);
  --ring: oklch(0 0 0);
  --chart-1: oklch(0.8100 0.1700 75.3500);
  --chart-2: oklch(0.5500 0.2200 264.5300);
  --chart-3: oklch(0.7200 0 0);
  --chart-4: oklch(0.9200 0 0);
  --chart-5: oklch(0.5600 0 0);
  --sidebar: oklch(0.9900 0 0);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0 0 0);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.9400 0 0);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(0.9400 0 0);
  --sidebar-ring: oklch(0 0 0);
  --font-sans: Geist, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Geist Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 2px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.18;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow-md: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18);
  --shadow-lg: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18);
  --shadow-xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.45);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0 0 0);
  --foreground: oklch(1 0 0);
  --card: oklch(0.1400 0 0);
  --card-foreground: oklch(1 0 0);
  --popover: oklch(0.1800 0 0);
  --popover-foreground: oklch(1 0 0);
  --primary: oklch(1 0 0);
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0.2500 0 0);
  --secondary-foreground: oklch(1 0 0);
  --muted: oklch(0.2300 0 0);
  --muted-foreground: oklch(0.7200 0 0);
  --accent: oklch(0.3200 0 0);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.6900 0.2000 23.9100);
  --destructive-foreground: oklch(0 0 0);
  --border: oklch(0.2600 0 0);
  --input: oklch(0.3200 0 0);
  --ring: oklch(0.7200 0 0);
  --chart-1: oklch(0.8100 0.1700 75.3500);
  --chart-2: oklch(0.5800 0.2100 260.8400);
  --chart-3: oklch(0.5600 0 0);
  --chart-4: oklch(0.4400 0 0);
  --chart-5: oklch(0.9200 0 0);
  --sidebar: oklch(0.1800 0 0);
  --sidebar-foreground: oklch(1 0 0);
  --sidebar-primary: oklch(1 0 0);
  --sidebar-primary-foreground: oklch(0 0 0);
  --sidebar-accent: oklch(0.3200 0 0);
  --sidebar-accent-foreground: oklch(1 0 0);
  --sidebar-border: oklch(0.3200 0 0);
  --sidebar-ring: oklch(0.7200 0 0);
  --font-sans: Geist, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Geist Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 2px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.18;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18);
  --shadow-md: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18);
  --shadow-lg: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18);
  --shadow-xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 1px 2px 0px hsl(0 0% 0% / 0.45);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Domain generation (must-have)
For a new domain, generator must:
- Create schema + migration stub
- Create repository + service
- Create external API route and/or internal actions (based on selection)
- Create keys + hooks for list/detail + create/update/delete (based on selection)
- Create UI stubs and route placeholders (based on selection)

### Doctor (must-have)
- Detect missing env vars
- Detect missing required folders/files
- Detect boundary violations via static analysis rules (regex-based in v1 is acceptable)

## Non-functional requirements
- TypeScript strict mode passes
- ESLint passes
- `pnpm lint` / `npm run lint` runs clean (define one in generated repo)
- Reasonable DX: clear error messages from CLI, deterministic output
- Idempotency: running the same generator twice should not corrupt code (either skip, merge safely, or fail with a clear message)

### Testability baseline (enterprise) (must-have)
0xstack must ship a testing story so the platform remains refactorable.

Requirements:
- Domain generator must create minimal tests per domain:
  - `tests/<domain>/<domain>.repo.test.ts`
  - `tests/<domain>/<domain>.rules.test.ts`
  - `tests/<domain>/<domain>.actions.test.ts`
- Webhook/billing modules must include tests for:
  - signature verification helper behavior
  - idempotency ledger behavior
- `doctor` must verify tests exist for generated domains (warn-only by default, error in strict profile).

## Tech choices (recommended defaults)
- Runtime: Node.js LTS
- Framework: Next.js (App Router), TypeScript
- DB: Supabase Postgres
- ORM: Drizzle
- Validation: Zod
- Client cache: TanStack Query
- Client UI state: Zustand (UI/transient only)
- MDX/blog: MDX compilation pipeline (content from `content/blog/*.mdx`)
- UI: shadcn + Tailwind
- Auth: Better Auth
- Payments: Dodo Payments
- Storage: Google Cloud Storage (`@google-cloud/storage`)
- Formatting: Prettier (optional)
- Testing (later): Vitest + Playwright (stretch)

## Baseline dependencies (must-have)
0xstack must install dependencies by **capability/module**, and `doctor` must verify that:
- enabled modules have their required packages installed
- disabled modules do not leave unused heavy deps behind (warn-only)
- imports match installed deps (best-effort static check)

### Core runtime
- **`zod`** → `lib/env/*`, `lib/validators/*`, action/input validation
- **`drizzle-orm`**, **`drizzle-kit`** → `lib/db/*` (schema + migrations)
- **`postgres`** (or equivalent Postgres driver chosen by the starter) → `lib/db/index.ts`

### Auth (Better Auth)
- **`better-auth`** → `lib/auth/better-auth.ts`, `lib/auth/server.ts`, `app/api/auth/[...all]/route.ts`
- **`@better-auth/drizzle-adapter`** → `lib/auth/better-auth.ts` (DB adapter wiring)

### Payments (Dodo)
- **`@dodopayments/nextjs`** → `app/api/v1/billing/webhook/route.ts` (adapter-based webhook handler)
- **`standardwebhooks`** → `lib/billing/dodo.webhooks.ts` (manual verification option / testing / portability)

### Storage (Google Cloud Storage)
- **`@google-cloud/storage`** → `lib/storage/gcs.ts`, `lib/services/storage.service.ts`

### Client data + UI state
- **`@tanstack/react-query`** → `lib/hooks/client/*`, `app/providers` (QueryClientProvider)
- **`zustand`** → `lib/stores/*` (UI/transient state only)

### MDX / Blog pipeline
Minimum baseline (local MDX in `content/blog/*.mdx`):
- **`gray-matter`** → `lib/content/frontmatter.ts`
- **`next-mdx-remote`** → `lib/content/mdx.ts` (compile/render pipeline)
- **`remark-gfm`** → `lib/content/mdx.ts` (markdown extensions)
- **`rehype-slug`**, **`rehype-autolink-headings`** → `lib/content/mdx.ts` (heading UX)

Optional enhancements (toggle-able module flags; doctor warns if missing when enabled):
- **`rehype-pretty-code`** + **`shiki`** → code highlighting

### SEO / Structured data
- **`schema-dts`** → `lib/seo/jsonld.ts` (typed JSON-LD payloads)

### Doctor enforcement rules (dependency-aware)
`doctor` must check, at minimum:
- If `app/api/auth/[...all]/route.ts` exists → `better-auth` + `@better-auth/drizzle-adapter` present.
- If any `app/api/v1/billing/*` route exists → `@dodopayments/nextjs` present.
- If `lib/billing/dodo.webhooks.ts` imports Standard Webhooks → `standardwebhooks` present.
- If `lib/storage/gcs.ts` exists → `@google-cloud/storage` present.
- If `lib/hooks/client/*` exists → `@tanstack/react-query` present.
- If `lib/stores/*` exists → `zustand` present.
- If `app/blog/*` exists → `gray-matter` + `next-mdx-remote` + mdx plugins present.

## Project state model (platform core) (must-have)
0xstack must maintain an internal representation of “what this project is” so `doctor`, `sync`, and docs are consistent.

Conceptual shape:

```ts
interface ProjectState {
  config: unknown
  modules: Array<{ id: string; installed: boolean; activated: boolean }>
  domains: Array<{ id: string; hasRepo: boolean; hasLoader: boolean; hasRules: boolean; hasActions: boolean }>
  routes: Array<{ path: string; kind: "api" | "page"; module?: string }>
  schema: { tables: string[]; hasBetterAuthCore: boolean }
}
```

Requirements:
- `doctor` and `sync` must compute this state (from config + filesystem + schema exports) and use it as the source of truth.
- `docs sync` must render docs from this state.

## Deliverables

### Repo structure (mono or single)
Preferred (monorepo):
- `packages/cli` — `0xstack` CLI
- `packages/core` — interfaces/contracts + shared utilities
- `packages/modules/*` — installable modules (billing/org/ai)
- `examples/saas` — dogfood example output

Alternative (single repo):
- `cli/` + `templates/` + `modules/` + `examples/`

### Template strategy
Use a hybrid approach:
- **File templates** for initial repo skeleton (init)
- **AST/structured generators** for adding domains/modules safely (generate/add)

## Milestones

### M0 — Prototype (1–2 days)
- CLI skeleton, `init` generates a minimal runnable Next.js app
- Supabase + Drizzle connected
- shadcn installed

### M1 — Hybrid entrypoints (2–5 days)
- Service + repository pattern scaffolded
- `generate domain` creates schema/repo/service + server actions
- Optional external API routes from same service layer

### M2 — Modules (1–2 weeks)
- `doctor` baseline checks
- `orgs` module (multi-tenant baseline)

### M3 — Polishing (ongoing)
- better merge/idempotency
- upgrade/codemods
- docs, examples, CI

## Success metrics
- Time to first running app: < 10 minutes
- Time to add a new domain module: < 5 minutes
- 80%+ of typical “first week” pages exist (marketing/auth/app shell + example domain)
- Low divergence across projects (doctor reports few/no violations)

## Risks & mitigations
- **Generators become brittle**: start with limited patterns; introduce structured edits (AST) for critical files.
- **Too many options**: keep v1 prompts small; add `--preset` for common paths.
- **Over-opinionation**: allow overrides via config file (`0xstack.config.*`) and module selection.

## Open questions (to decide before v1)
- API versioning default: `api/v1/*` or unversioned?
- Preferred package manager in generated repos: `pnpm` vs `npm`?
- Multi-tenancy default: always-on orgs or opt-in?

