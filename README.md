# 0xmilord

`0xmilord` is a starter-system CLI that generates and maintains **production-ready Next.js apps** with a strict, enterprise-friendly architecture.

## What it generates
- Next.js App Router (TypeScript) + Tailwind + shadcn/ui
- **Flat structure**: no `src/`, no `(route groups)`, all non-`app/` code lives in `lib/`
- Postgres + Drizzle ORM baseline with migrations
- Better Auth only (text IDs)
- Tiered architecture: DB → repos → services → server actions/loaders → UI
- Optional modules: SEO, MDX blog, Dodo billing, GCS storage, jobs, observability (config-gated)

## CLI (local dev)
```bash
pnpm install
pnpm -r build
node packages/cli/dist/index.js --help
```

## CLI (usage)
```bash
# create a new app (interactive by default) - npm/npx first
npx 0xmilord init

# enforce baseline workflows in an existing app
npx 0xmilord baseline --profile minimal

# validate boundaries + env + required files
npx 0xmilord doctor --profile minimal

# keep docs/ inventories in sync
npx 0xmilord docs-sync

# generate a domain end-to-end
npx 0xmilord generate materials --with-api
```

pnpm alternative:

```bash
pnpm dlx 0xmilord init
pnpm dlx 0xmilord baseline --profile minimal
pnpm dlx 0xmilord doctor --profile minimal
pnpm dlx 0xmilord docs-sync
pnpm dlx 0xmilord generate materials --with-api
```

## Docs
- Product/architecture spec lives in `PRD.md`.
- Generated apps get a root `README.md`, plus `PRD.md` / `ARCHITECTURE.md` / `ERD.md` and `lib/*/README.md` via `docs-sync`.

