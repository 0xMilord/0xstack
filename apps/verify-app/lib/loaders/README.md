

<!-- AUTO-GENERATED START -->
# `lib/loaders`

## Purpose
- This folder owns a single architecture layer or subsystem in the CQRS stack.

## Allowed imports
- Prefer importing *down* the stack (UI → loaders/actions → services → repos).
- `app/api/v1/*` must call `lib/services/*` (never repos directly).

## Entry points (detected)

- `api-keys.loader.ts`
- `assets.loader.ts`
- `billing.loader.ts`
- `blog.loader.ts`
- `orgs.loader.ts`
- `pwa.loader.ts`
- `viewer.loader.ts`
- `webhook-ledger.loader.ts`

## Conventions
- Keep input validation in `lib/rules/*` and parse at boundaries (actions/routes).
- Prefer tag-based revalidation for read models (`lib/cache`).
<!-- AUTO-GENERATED END -->
