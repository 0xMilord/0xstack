

<!-- AUTO-GENERATED START -->
# `lib/repos`

## Purpose
- This folder owns a single architecture layer or subsystem in the CQRS stack.

## Allowed imports
- Prefer importing *down* the stack (UI → loaders/actions → services → repos).
- `app/api/v1/*` must call `lib/services/*` (never repos directly).

## Entry points (detected)

- `api-keys.repo.ts`
- `assets.repo.ts`
- `billing.repo.ts`
- `org-members.repo.ts`
- `orgs.repo.ts`
- `push-subscriptions.repo.ts`
- `user-profiles.repo.ts`
- `webhook-events.repo.ts`

## Conventions
- Keep input validation in `lib/rules/*` and parse at boundaries (actions/routes).
- Prefer tag-based revalidation for read models (`lib/cache`).
<!-- AUTO-GENERATED END -->
