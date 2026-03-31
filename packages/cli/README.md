# 0xmilord

An opinionated starter-system CLI that generates **production-ready Next.js apps** with a strict architecture and enterprise-grade modules (config-gated).

## Install / Run

### Use without installing (recommended)
```bash
npx 0xmilord init
```

### Install globally
```bash
npm i -g 0xmilord
# or
pnpm add -g 0xmilord
```

## Quick start
```bash
npx 0xmilord init
cd my-app
npx 0xmilord baseline --profile milord
npx 0xmilord doctor --profile milord
pnpm dev
```

pnpm alternative:

```bash
pnpm dlx 0xmilord init
cd my-app
pnpm dlx 0xmilord baseline --profile milord
pnpm dlx 0xmilord doctor --profile milord
pnpm dev
```

## Commands
- `0xmilord init`: scaffold a Next.js app (interactive)
- `0xmilord baseline`: enforce baseline (deps, auth schema, migrations, module activation, docs)
- `0xmilord doctor`: validate boundaries + env + required files
- `0xmilord sync`: reconcile repo with `0xmilord.config.ts`
- `0xmilord docs-sync`: regenerate docs using stable markers
- `0xmilord generate <domain>`: generate a domain end-to-end (schema → repo → service → actions/loaders → UI)
- `0xmilord add <module>`: enable a module in config and apply baseline

## Architecture (what gets generated)
- **Flat structure**: routes in `app/`; everything else in `lib/` (no `src/`, no route groups)
- **Better Auth only** (text IDs)
- **DB**: Postgres + Drizzle
- **Layering**:
  - `lib/repos/*`: DB access (no HTTP/UI)
  - `lib/services/*`: business logic + permissions
  - `lib/actions/*`: internal writes (Server Actions)
  - `lib/loaders/*`: cached reads (RSC-friendly)
  - `app/api/v1/*`: external HTTP APIs (must call services, not repos)

## Modules (config-gated)
Enabled via `0xmilord.config.ts` profiles/modules.
- **SEO**: `robots.ts`, `sitemap.ts`, OG/Twitter images, JSON-LD helpers
- **Blog (MDX)**: content loader + routes + RSS
- **Billing (Dodo)**: checkout/portal/webhook + reconciliation + idempotency ledger
- **Storage (GCS)**: signed upload + asset index
- **Email (Resend)**: auth emails (verify + reset) using React Email templates
- **Jobs / Observability**: baseline infra

## Environment
Generated apps validate env via Zod (`lib/env/*`). Start from `.env.example`.

## Release checklist (publisher)
1. Replace `REPLACE_ME_*` fields in `packages/cli/package.json`.
2. Ensure `dist/` is built (`pnpm -C packages/cli build`).
3. Publish (see README in repo root for commands).

