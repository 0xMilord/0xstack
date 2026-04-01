

<!-- AUTO-GENERATED START -->
# `lib/security`

## API key + rate limiting runbook
- External routes under `/api/v1/*` should use `guardApiRequest(req)` when session auth is not applicable.
- If `UPSTASH_REDIS_*` is configured, rate limiting is durable; otherwise a safe in-memory fallback is used.

## API keys lifecycle
- Keys are org-scoped and managed via `/app/api-keys`.
- Secrets are only shown once on creation; revoke to rotate.

## Entry points (detected)

- `api.ts`
- `csp.ts`
- `headers.ts`
- `request-id.ts`
<!-- AUTO-GENERATED END -->
