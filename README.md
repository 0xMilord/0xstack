# 0xstack

`0xstack` is a **starter-system CLI**: it scaffolds and continuously reconciles a production-grade Next.js app with a strict architecture and config-gated “enterprise modules”.

## TL;DR

```bash
npx 0xstack init
cd my-app
npx 0xstack baseline --profile full
npx 0xstack doctor --profile full
pnpm dev
```

pnpm alternative:

```bash
pnpm dlx 0xstack init
```

## Keywords / Glossary
- **baseline**: the idempotent “make it correct” command (deps + auth schema generate + migrations + module activation + docs)
- **doctor**: static verification (env, required files, boundary rules)
- **sync**: reconcile repo structure + docs (non-destructive)
- **module**: a capability that can be installed but **only activated when enabled** in config (routes/files removed when disabled)
- **write highway**: internal DB writes via Server Actions (`lib/actions/*` → services → repos)
- **read highway**: reads via loaders (`lib/loaders/*`) with RSC-friendly caching
- **external API highway**: HTTP routes under `app/api/v1/*` (must call services; never repos directly)

## What it generates (app output)
- **Next.js App Router** + TypeScript + Tailwind + shadcn/ui
- **Flat structure**:
  - routes: `app/*`
  - everything else: `lib/*`
  - **no `src/`**, **no `()` route groups**
- **Auth**: Better Auth only (**text IDs**)
- **DB**: Postgres + Drizzle ORM + migrations
- **Architecture layers**:
  - `lib/db/*`: DB client + schema export surface
  - `lib/repos/*`: DB access
  - `lib/services/*`: business logic + permissions
  - `lib/rules/*`: Zod schemas for inputs
  - `lib/actions/*`: Server Actions (writes)
  - `lib/loaders/*`: cached reads
  - `app/api/v1/*`: external HTTP APIs
- **Docs**: root `README.md`, `PRD.md`, `ARCHITECTURE.md`, `ERD.md`, and `lib/*/README.md`

## Commands (npm/npx first)

### `init`
Scaffold a new app (interactive). Supports creating into a new folder or current folder.

```bash
npx 0xstack init
```

### `baseline`
Idempotent “enterprise reconciliation”:
- installs deps for enabled modules
- generates Better Auth schema
- ensures core tables + module tables
- generates Drizzle migrations (and migrates if `DATABASE_URL` is set)
- activates enabled modules (writes routes + lib wiring)
- upgrades public/auth pages (if still shell templates)
- generates docs (README/PRD/ARCH/ERD + subsystem READMEs)

```bash
npx 0xstack baseline --profile full
```

### `doctor`
Validates:
- env schema presence
- required files for enabled modules
- boundary rules (routes must not import repos directly)

```bash
npx 0xstack doctor --profile full
```

### `generate <domain>`
Generates a domain end-to-end:
- schema table (text IDs)
- repo/service/actions/loaders/rules
- optional API route (`--with-api`)
- app route page under `/app/<plural>`

```bash
npx 0xstack generate materials --with-api
```

### `docs-sync`
Regenerate docs inventories using stable markers:

```bash
npx 0xstack docs-sync
```

### pnpm alternative

```bash
pnpm dlx 0xstack init
pnpm dlx 0xstack baseline --profile full
pnpm dlx 0xstack doctor --profile full
pnpm dlx 0xstack docs-sync
pnpm dlx 0xstack generate materials --with-api
```

## Modules (overview)
Enabled via `0xstack.config.ts` profiles/modules.
- **SEO**: robots/sitemap + OG/Twitter images + JSON-LD helpers
- **Blog (MDX)**: content loader + routes + RSS
- **Billing (Dodo)**: checkout/portal/webhook + ledger + reconciliation tables
- **Storage (GCS)**: signed upload + `assets` index
- **Email (Resend)**: verification + reset emails via React Email templates
- **Jobs / Observability**: baseline infra

## Local development (this repo)
```bash
pnpm install
pnpm -r build
node packages/cli/dist/index.js --help
```

