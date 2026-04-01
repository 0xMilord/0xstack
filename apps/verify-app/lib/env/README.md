

<!-- AUTO-GENERATED START -->
# `lib/env`

## Production runbook
- All validation is centralized in `lib/env/schema.ts` (composed from `lib/env/*`).
- If `EnvSchema.parse(process.env)` throws, the app should fail fast (misconfigured deployment).

## Required core variables
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

## Optional core variables
- `API_KEY` (server-to-server auth for `/api/v1/*` routes when no session is present)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (durable rate limiting for external routes)

## Module variables (only when that module is enabled)
- Billing (Dodo): `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_PAYMENTS_RETURN_URL`, `DODO_PAYMENTS_STARTER_PRICE_ID` (optional `DODO_PAYMENTS_PLANS_JSON`)
- Storage (GCS): `GCS_BUCKET`, `GCS_PROJECT_ID`
- PWA push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Email (Resend): `RESEND_API_KEY`, `RESEND_FROM`
- Observability: `SENTRY_DSN`

## Entry points (detected)

- `billing-stripe.ts`
- `billing.ts`
- `email.ts`
- `observability.ts`
- `pwa.ts`
- `schema.ts`
- `server.ts`
- `storage-s3.ts`
- `storage-supabase.ts`
- `storage.ts`
<!-- AUTO-GENERATED END -->
