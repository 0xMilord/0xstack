

<!-- AUTO-GENERATED START -->
# `lib/services`

## Purpose
- This folder owns a single architecture layer or subsystem in the CQRS stack.

## Allowed imports
- Prefer importing *down* the stack (UI → loaders/actions → services → repos).
- `app/api/v1/*` must call `lib/services/*` (never repos directly).

## Entry points (detected)

- `api-keys.service.ts`
- `auth.service.ts`
- `billing.service.ts`
- `orgs.service.ts`
- `profiles.service.ts`
- `push-subscriptions.service.ts`
- `push.service.ts`
- `storage.service.ts`
- `viewer.service.ts`
- `webhook-ledger.service.ts`

## Conventions
- Keep input validation in `lib/rules/*` and parse at boundaries (actions/routes).
- Prefer tag-based revalidation for read models (`lib/cache`).
<!-- AUTO-GENERATED END -->
