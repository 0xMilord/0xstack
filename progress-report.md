# Progress report — 0xstack (as of 2026-03-31)

This is a **brutally honest** status report of what’s implemented, what’s “plug-and-play”, and what’s still missing or too basic—broken down by **module** and by **layer** (UI → loaders/actions → services → repos → APIs → caching → docs).

## How to read this

- **Plug-and-play**: user enables a module, sets env vars, runs `baseline`, then uses the feature end-to-end **without writing glue code**.
- **CQRS contract**:
  - **Read path**: RSC pages read via `lib/loaders/*` (cached) → `lib/services/*` → `lib/repos/*`.
  - **Write path**: internal mutations happen via `lib/actions/*` → `lib/services/*` → `lib/repos/*` with targeted revalidation.
  - **External API**: `app/api/v1/*` calls **services**, never repos directly.

## High-level state

- **CLI + baseline orchestration**: strong and improving (idempotent steps, installs deps, Better Auth schema generation, Drizzle migrations, module activation, page upgrades, docs).
- **Enterprise shape exists**, but **domain cohesion is incomplete** in a few critical areas (org-scoping across storage/billing, billing status read model/UI, storage upload UX).

## Modules inventory (what exists today)

This list matches what the CLI currently registers/activates (as of this report):

- **Foundations**: `ui-foundation`, `core-db-state`, `auth-core`, `cache`, `observability`, `security-api`, `webhook-ledger`, `jobs`
- **Product modules**: `seo`, `blogMdx`, `billing-dodo`, `storage-gcs`, `email-resend`, `pwa`

For “what’s actually generated”, see each module’s **Generated output (verify-app)** subsection below.

---

## CLI commands (product surface)

### `init` (scaffold)

**Done**

- Creates a Next.js App Router project with flat structure (no `src/`, no `()` groups).
- Installs shadcn/ui and foundational deps.
- Interactive prompts include modules + **theme selection** (Default/Corporate Blue/Amber/Grass).
- Theme write is stable even after shadcn modifies `app/globals.css`.

**Missing / substandard**

- Underlying tools (create-next-app, pnpm) naturally emit verbose logs; CLI progress is fine but not perfectly quiet.

### `baseline` (idempotent reconciliation)

**Done**

- Installs required deps based on enabled modules.
- Runs Better Auth schema generation and keeps it integrated.
- Ensures baseline tables exist (orgs/api_keys/assets/billing/push/webhook ledger).
- Runs drizzle-kit migration generation (and migrate when `DATABASE_URL` is set).
- Activates modules to generate routes + lib wiring.
- Upgrades shell pages to real templates.
- Generates docs (`README/PRD/ARCH/ERD + lib/*/README.md`).

**Missing / substandard**

- Progressive activation is mostly honored by route removal, but some shared libs may exist even when disabled (intentional for stability). Needs explicit documentation per module.

### `doctor` (static checks)

**Done**

- Validates env schemas exist for enabled modules.
- Enforces the most important boundary: API routes must not import repos directly.

**Missing / substandard**

- Needs deeper checks, for example:
  - Query/mutation key convention completeness.
  - Loader purity checks (loaders shouldn’t import actions/rules).
  - Drift checks between schema and migrations beyond “exists”.

### `generate <domain>`

**Done**

- Generates schema + repo + service + rules + actions + loaders + query/mutation keys + optional API + UI.
- CRUD paths exist (insert/update/delete).

**Missing / substandard**

- Does not enforce multi-tenant org-scoping patterns by default (it generates the “shape”, not always the “policy”).

---

## Core architecture / foundations

### Config + env validation (always-on)

**Done**

- Runtime config schema exists and supports module gating.
- Central env loader exists, plus module env schemas (email/billing/storage/pwa) when enabled.

**Missing / substandard**

- Needs a single “env runbook” section (what to set in what environment; how to rotate keys; how to validate in CI).

#### Generated output (verify-app)

- `0xstack.config.ts` (project config file)
- `lib/0xstack/config.ts` (runtime schema for config)
- `lib/env/server.ts` (env loader)
- `lib/env/schema.ts` (combined schema wiring)

### UI Foundation (`ui-foundation`)

**Done**

- Header + footer generated; header is **auth-aware** (server component uses `loadViewer()`).
- Layout patching ensures Providers + header/footer wrapper.
- Settings page upgraded from shell to a real screen (viewer + signout + links).

**Missing / substandard**

- No documented “app shell guard” pattern (e.g., standard redirect for unauthenticated `/app/*`).

#### Generated output (verify-app)

- **Layouts / providers**
  - `app/layout.tsx`
  - `app/providers.tsx`
  - `app/app/layout.tsx`
  - `app/app/page.tsx`
  - `app/app/settings/page.tsx`
- **Components**
  - `components/layout/site-header.tsx` (auth-aware)
  - `components/layout/site-footer.tsx`
  - `components/layout/theme-toggle.tsx`
- **Back-compat re-exports (older apps)**
  - `lib/components/layout/*` (re-exports)

### DB baseline + state (`core-db-state`)

**Done**

- Ensures core tables are present (orgs, assets, api_keys, billing, etc.) via schema editing.
- Generates baseline repos/services/actions/rules for orgs + assets/billing repos.

**Missing / substandard**

- Org-scoped ownership/authorization rules are still uneven across domains (see Orgs/Storage/Billing gaps).

#### Generated output (verify-app)

- **Schema**
  - `lib/db/schema.ts` (includes core + module tables)
- **Repos**
  - `lib/repos/orgs.repo.ts`
  - `lib/repos/org-members.repo.ts`
  - `lib/repos/user-profiles.repo.ts`
  - `lib/repos/assets.repo.ts`
  - `lib/repos/billing.repo.ts`
- **Services**
  - `lib/services/orgs.service.ts`
  - `lib/services/profiles.service.ts`
- **Actions / rules / loaders / keys**
  - `lib/actions/orgs.actions.ts`
  - `lib/rules/orgs.rules.ts`
  - `lib/loaders/orgs.loader.ts`
  - `lib/query-keys/orgs.keys.ts`
  - `lib/mutation-keys/orgs.keys.ts`
- **UI**
  - `app/app/orgs/page.tsx`

### Cache (`cache`)

**Done**

- Central cache primitives exist:
  - L1 LRU
  - Next.js Data Cache (`unstable_cache`)
  - tag revalidation helpers
- Viewer loader uses caching with tags.

**Missing / substandard**

- Not enough domains consistently use cache tags (mostly viewer so far).

#### Generated output (verify-app)

- `lib/cache/config.ts`
- `lib/cache/lru.ts`
- `lib/cache/server.ts`
- `lib/cache/revalidate.ts`
- `lib/cache/index.ts`

### Observability (`observability`)

**Done**

- Structured logger (`lib/utils/logger.ts`) with redaction and dev/prod formatting.

**Missing / substandard**

- No tracing propagation across actions → services → repos beyond log context patterns.

#### Generated output (verify-app)

- `lib/utils/logger.ts`

### Security API (`security-api`)

**Done**

- `lib/security/api.ts` guard exists (API key verification + rate limit scaffolding).
- API keys table + repo + verify service (hash + prefix lookup) exist.

**Missing / substandard**

- Durable rate limiting deps exist, but enforcement isn’t yet “fully enterprise”:
  - needs config gating and consistent use across all v1 routes
  - needs a clear policy (per org vs per IP vs per API key)

#### Generated output (verify-app)

- **Guards**
  - `lib/security/api.ts`
  - `lib/security/request-id.ts`
  - `lib/security/headers.ts`
  - `lib/security/csp.ts`
- **API keys**
  - `lib/repos/api-keys.repo.ts`
  - `lib/services/api-keys.service.ts`

### Webhook ledger (`webhook-ledger`)

**Done**

- Durable idempotency table (`webhook_events`) and repo are generated.

**Missing / substandard**

- Event schemas aren’t normalized across providers; reconciliation is best-effort.

#### Generated output (verify-app)

- `lib/repos/webhook-events.repo.ts`
- Table present in `lib/db/schema.ts` (webhook ledger)

### Jobs (`jobs`)

**Done**

- Module exists and can generate baseline job scaffolding.

**Missing / substandard**

- No concrete production driver wiring end-to-end beyond minimal patterns.

#### Generated output (verify-app)

- `app/api/v1/jobs/reconcile/route.ts`

---

## Auth (Better Auth) (mostly plug-and-play)

### Plug-and-play features

- Real Better Auth handler route exists.
- Auth pages exist and are functional: login, signup (“get started”), forgot password, reset password.
- Email integration (if enabled): Resend templates are wired into Better Auth flows.
- Viewer read model exists:
  - `viewer.service` reads session
  - `viewer.loader` caches with tags
  - `use-viewer` hook exposes viewer + signout mutation
- Profile bootstrapping exists: `user_profiles` row is ensured on first session read.

### Gaps

- Org-aware redirects exist in places, but the “active org” backbone still needs tightening.
- Optional external auth APIs exist, but aren’t yet treated as a first-class public contract with stable schemas/versioning docs.

### Substandard / too basic

- Some flows depend on client-side assumptions; error messaging and retry UX could be more enterprise-grade.

#### Generated output (verify-app)

- **Better Auth route**
  - `app/api/auth/[...all]/route.ts`
- **Auth pages**
  - `app/login/page.tsx`
  - `app/get-started/page.tsx`
  - `app/forgot-password/page.tsx`
  - `app/reset-password/page.tsx`
- **Auth domain (always-on)**
  - `lib/auth/auth.ts`
  - `lib/auth/server.ts`
  - `lib/auth/auth-client.ts`
  - `lib/auth/auth-schema.ts`
  - `lib/services/viewer.service.ts`
  - `lib/services/auth.service.ts`
  - `lib/loaders/viewer.loader.ts`
  - `lib/actions/auth.actions.ts`
  - `lib/hooks/client/use-viewer.ts`
  - `lib/query-keys/auth.keys.ts`
  - `lib/mutation-keys/auth.keys.ts`
  - `app/api/v1/auth/viewer/route.ts`
  - `app/api/v1/auth/signout/route.ts`

---

## Orgs (partial plug-and-play)

### Done

- Core org tables exist (`orgs`, `org_members`).
- `/app/app/orgs` UI exists (create/list/select active org).
- Active org is stored (cookie pattern exists).

### Gaps (not fully plug-and-play yet)

- Active-org backbone isn’t fully used everywhere:
  - Storage should default to org-scoped assets when an active org is selected.
  - Billing should be org-scoped (subscription belongs to org).
- Membership/roles: no robust role model (owner/admin/member) applied consistently across services/rules.
- Guards: missing a standard `requireActiveOrg()` helper and consistent redirects for `/app/*` pages.

### Substandard / too basic

- Minimal UI for org management; needs polish and stronger empty/error states.

#### Generated output (verify-app)

- `app/app/orgs/page.tsx`
- `lib/actions/orgs.actions.ts`
- `lib/loaders/orgs.loader.ts`
- `lib/services/orgs.service.ts`
- `lib/repos/orgs.repo.ts`
- `lib/repos/org-members.repo.ts`
- `lib/query-keys/orgs.keys.ts`
- `lib/mutation-keys/orgs.keys.ts`

---

## Storage (GCS) (partially plug-and-play)

### Done (server/API)

- GCS client is real (`@google-cloud/storage`).
- Routes exist:
  - `POST /api/v1/storage/sign-upload` (signed upload + writes `assets`)
  - `POST /api/v1/storage/sign-read` (signed read URL)
  - `GET /api/v1/storage/assets` (list)
  - `DELETE /api/v1/storage/assets/[assetId]` (DB delete + best-effort GCS delete)
- `assets` table exists; repo supports insert/list/delete.

### Done (UI)

- `/app/app/assets` exists and supports list/open/delete.

### Gaps (not plug-and-play yet)

- Upload UX is missing:
  - UI does not yet implement “pick file → sign-upload → PUT to GCS → refresh list”.
- Ownership + org-scoping:
  - APIs currently list user-owned assets; org assets exist but UI + route defaults don’t use active org.
  - Needs a consistent object-key policy (users/{userId}/… vs orgs/{orgId}/…).

### Substandard / too basic

- No pagination, search, or metadata display; no “asset details” page.

#### Generated output (verify-app)

- **Env + client**
  - `lib/env/storage.ts`
  - `lib/storage/gcs.ts`
- **Services / repos / keys**
  - `lib/services/storage.service.ts`
  - `lib/repos/assets.repo.ts`
  - `lib/query-keys/assets.keys.ts`
  - `lib/mutation-keys/assets.keys.ts`
- **API routes**
  - `app/api/v1/storage/sign-upload/route.ts`
  - `app/api/v1/storage/sign-read/route.ts`
  - `app/api/v1/storage/assets/route.ts`
  - `app/api/v1/storage/assets/[assetId]/route.ts`
- **UI**
  - `app/app/assets/page.tsx`

---

## Billing (Dodo) (infra exists; UX improving but incomplete)

### Done (infra)

- Dodo checkout/portal/webhook routes exist.
- Webhook idempotency ledger exists (`webhook_events`).
- Reconciliation writes durable state into:
  - `billing_customers`
  - `billing_subscriptions`

### Done (UX pages)

- `/pricing` exists with a plan card and “start subscription”.
- `/billing/success` and `/billing/cancel` pages exist.
- `/app/app/billing` page exists with portal entrypoint.
- Env var added: `DODO_PAYMENTS_STARTER_PRICE_ID`.

### Gaps (not plug-and-play yet)

- Subscription status read model is missing:
  - `billing.loader.ts` + `useBillingStatus()` + UI for status/renewal/plan.
- Org scoping is missing:
  - subscription should belong to active org (or org chosen at checkout).
  - checkout should include org context in metadata so reconciliation maps correctly.
- Plan system is minimal:
  - currently one plan via one env var
  - needs a plan registry (multiple plans, features, seats)

### Substandard / too basic

- Billing UI doesn’t show “current plan”, renewal, invoices, or state transitions.

#### Generated output (verify-app)

- **Env + webhooks**
  - `lib/env/billing.ts`
  - `lib/billing/dodo.webhooks.ts`
  - `lib/services/billing.service.ts`
  - `lib/repos/billing.repo.ts`
  - `lib/repos/webhook-events.repo.ts`
- **API routes**
  - `app/api/v1/billing/checkout/route.ts`
  - `app/api/v1/billing/portal/route.ts`
  - `app/api/v1/billing/webhook/route.ts`
- **UX routes**
  - `app/pricing/page.tsx`
  - `app/billing/success/page.tsx`
  - `app/billing/cancel/page.tsx`
  - `app/app/billing/page.tsx`

---

## Email (Resend) (mostly plug-and-play)

### Done

- Resend wiring exists.
- React Email templates exist: verify email + reset password.
- Wired into Better Auth flows.

### Gaps / basic areas

- Needs more template variants if PRD expects them (invites, receipts, billing notices).

#### Generated output (verify-app)

- `lib/env/email.ts`
- `lib/email/resend.ts`
- `lib/email/auth-emails.ts`
- `lib/email/templates/verify-email.tsx`
- `lib/email/templates/reset-password.tsx`

---

## Blog (MDX) + SEO (present; needs enterprise completeness audit)

### Done

- Blog module exists with MDX pipeline and routes.
- SEO module exists (robots/sitemap/OG/Twitter/JSON-LD utilities per PRD).

### Gaps / likely missing (needs verification against PRD)

- Per-post metadata completeness:
  - strict frontmatter validation (zod), publish filtering, canonical URLs
  - OG image generation (`opengraph-image.tsx`, `twitter-image.tsx`) coverage
- Sitemap completeness for dynamic app/blog pages.

#### Generated output (verify-app)

- **Blog**
  - `content/blog/hello-world.mdx`
  - `lib/loaders/blog.loader.ts`
  - `app/blog/page.tsx`
  - `app/blog/[slug]/page.tsx`
  - `app/rss.xml/route.ts`
- **SEO**
  - `app/robots.ts`
  - `app/sitemap.ts`
  - `app/opengraph-image.tsx`
  - `app/twitter-image.tsx`
  - `lib/seo/jsonld.ts`

---

## PWA (infra exists; product UX missing)

### Done

- Manifest, service worker, offline page.
- Push foundations exist:
  - VAPID env
  - DB-backed push subscriptions
  - subscribe/unsubscribe/send routes (service-layer mediated)

### Gaps (not plug-and-play yet)

- No UI surface for:
  - enabling notifications
  - viewing subscription status
  - sending a test push
- Service worker caching strategy is basic; needs versioning, runtime caching rules, and update UX.

#### Generated output (verify-app)

- **Public**
  - `public/manifest.webmanifest`
  - `public/sw.js`
  - `public/offline.html`
- **Env**
  - `lib/env/pwa.ts`
- **Client**
  - `lib/pwa/register-sw.client.ts`
  - `lib/pwa/offline-storage.ts`
- **Push**
  - `lib/pwa/push.ts`
  - `lib/repos/push-subscriptions.repo.ts`
  - `lib/services/push-subscriptions.service.ts`
  - `app/api/v1/pwa/push/subscribe/route.ts`
  - `app/api/v1/pwa/push/unsubscribe/route.ts`
  - `app/api/v1/pwa/push/send/route.ts`

---

## Docs (good skeleton; needs deeper module runbooks)

### Done

- Root `README.md` improved (modules + CQRS).
- `docs-sync` generates inventories and an ERD derived from migrations.

### Gaps / basic

- Each “enterprise module” needs a runbook section:
  - required env vars
  - how to test locally
  - failure modes
  - expected webhook payload mapping
  - security considerations (API keys, rate limiting policy)

---

## Top priority work left (highest impact)

### 1) Active-org backbone (unblock multi-tenant cohesion)

- Add `lib/orgs/active-org.ts` helpers (read/write cookie, `requireActiveOrg()`).
- Update storage + billing services/APIs to default to active org context.
- Ensure redirects: logged in but no org → `/app/orgs`.

### 2) Storage upload UX (make assets truly plug-and-play)

- Extend `/app/app/assets` with upload pipeline:
  - sign-upload → `PUT uploadUrl` → refresh list
- Show progress + errors and display metadata (size/type).

### 3) Billing status read model + UI

- Add loader/hook to fetch current subscription for active org/user.
- Show status on `/app/app/billing` and in header/settings.
- Expand plan registry beyond a single env var.

### 4) SEO/Blog enterprise completeness audit

- Validate frontmatter schemas, canonical base URL wiring, OG/Twitter images, sitemaps.

### 5) Doctor deepening

- Add checks for CQRS conventions (loaders/actions/services boundaries).
- Add route coverage checks (module enabled ⇒ expected routes exist; disabled ⇒ removed).

---

## Known substandard / minimal areas (call-out list)

- Billing: missing subscription status UI + org-scoped checkout metadata.
- Storage: missing upload UI; org-scoped assets not first-class.
- Orgs: no roles/permissions model; active org not universally enforced.
- PWA: no UI surface; SW caching strategy is basic.
- Security: durable rate limiting policy not uniformly enforced.

