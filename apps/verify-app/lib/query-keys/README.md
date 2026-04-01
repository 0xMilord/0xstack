

<!-- AUTO-GENERATED START -->
# `lib/query-keys`

## Purpose
- This folder owns a single architecture layer or subsystem in the CQRS stack.

## Allowed imports
- Prefer importing *down* the stack (UI → loaders/actions → services → repos).
- `app/api/v1/*` must call `lib/services/*` (never repos directly).

## Entry points (detected)

- `api-keys.keys.ts`
- `assets.keys.ts`
- `auth.keys.ts`
- `billing.keys.ts`
- `index.ts`
- `orgs.keys.ts`
- `webhook-ledger.keys.ts`

## Conventions
- Keep input validation in `lib/rules/*` and parse at boundaries (actions/routes).
- Prefer tag-based revalidation for read models (`lib/cache`).
<!-- AUTO-GENERATED END -->
