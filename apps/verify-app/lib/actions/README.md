

<!-- AUTO-GENERATED START -->
# `lib/actions`

## Purpose
- This folder owns a single architecture layer or subsystem in the CQRS stack.

## Allowed imports
- Prefer importing *down* the stack (UI → loaders/actions → services → repos).
- `app/api/v1/*` must call `lib/services/*` (never repos directly).

## Entry points (detected)

- `api-keys.actions.ts`
- `assets.actions.ts`
- `auth.actions.ts`
- `billing.actions.ts`
- `orgs.actions.ts`
- `pwa.actions.ts`
- `webhook-ledger.actions.ts`

## Conventions
- Keep input validation in `lib/rules/*` and parse at boundaries (actions/routes).
- Prefer tag-based revalidation for read models (`lib/cache`).
<!-- AUTO-GENERATED END -->
