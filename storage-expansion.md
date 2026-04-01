# Storage & Billing Expansion Audit (GCS→S3/Supabase, Dodo→Stripe) — 0xstack

## Goal
Make **storage** and **billing** provider choices **plug-and-play** end-to-end (config → env → schema → repos → services → loaders/actions/hooks → API routes → UI → doctor → docs) with progressive activation (disabled providers ship **no routes** and avoid heavy imports where practical).

This doc is an **audit + change map** for expanding:
- Storage: `gcs` (existing) → add `s3`, `supabase`
- Billing: `dodo` (existing) → add `stripe` (optionally keep both available via config)

## Current state (what exists now)
### Storage
- **Only provider supported**: `storage: false | "gcs"`
  - Config: `packages/cli/src/core/config.ts`
  - Module: `packages/cli/src/core/modules/storage-gcs.module.ts`
- Generated app has:
  - `lib/storage/gcs.ts`
  - `lib/services/storage.service.ts` (GCS-specific)
  - Assets CQRS: `lib/loaders/assets.loader.ts`, `lib/actions/assets.actions.ts`
  - External routes: `/app/api/v1/storage/*`
  - UI: `/app/app/(workspace)/assets/*`

**Gap**: the storage service is **provider-specific** (imports GCS at top-level), and the module assumes a single provider.

### Billing
- **Only provider supported**: `billing: false | "dodo"`
  - Config: `packages/cli/src/core/config.ts`
  - Module: `packages/cli/src/core/modules/billing-dodo.module.ts`
- Generated app has:
  - Dodo webhook verification (`standardwebhooks`)
  - Dodo checkout/portal routes via `@dodopayments/nextjs`
  - Read model (`billing_subscriptions`, loader, UI)

**Gap**: no Stripe provider, and the billing service is Dodo-centric.

## Provider APIs (vendor docs summary)
### S3 (AWS SDK v3) presigned URLs
- Packages: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Pattern:
  - `getSignedUrl(s3, new PutObjectCommand({...}), { expiresIn })`
  - `getSignedUrl(s3, new GetObjectCommand({...}), { expiresIn })`
Source examples: AWS blog + `@aws-sdk/s3-request-presigner` npm docs.

### Supabase Storage signed URLs (supabase-js)
- Signed download: `supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)`
- Signed upload: `supabase.storage.from(bucket).createSignedUploadUrl(path, { upsert })`
Source: Supabase Storage JS API reference.

### Stripe webhook verification (Next.js App Router)
- Must use **raw body** + `stripe.webhooks.constructEvent(raw, signature, webhookSecret)`
- In route handler: `await request.text()` (or `arrayBuffer()`), then construct event.

## Target architecture (what we will add)
### Config surface
Update config schema to allow:
- `modules.storage: false | "gcs" | "s3" | "supabase"`
- `modules.billing: false | "dodo" | "stripe"`

Files:
- `packages/cli/src/core/config.ts`
- `packages/cli/src/core/modules/types.ts` (module context typing)
- `packages/cli/src/core/deps.ts` (deps per provider)
- `packages/cli/src/core/doctor/run-doctor.ts` (provider-gated checks)

### Storage provider abstraction (generated app)
Add an internal “provider boundary” so app code stays stable:
- `lib/storage/provider.ts` (types)
- `lib/storage/index.ts` (factory `getStorageProvider()` based on env/config)
- `lib/services/storage.service.ts` becomes **provider-agnostic** (delegates to provider)
- Provider implementations:
  - `lib/storage/providers/gcs.ts`
  - `lib/storage/providers/s3.ts`
  - `lib/storage/providers/supabase.ts`

Then reuse existing CQRS + routes + UI:
- `lib/actions/assets.actions.ts`, `lib/loaders/assets.loader.ts`
- `/app/api/v1/storage/sign-upload` + `/sign-read` + `/assets`

### Billing provider abstraction (generated app)
Add:
- `lib/billing/provider.ts` (types)
- `lib/billing/index.ts` (factory `getBillingProvider()`)
- Provider implementations:
  - `lib/billing/providers/dodo.ts`
  - `lib/billing/providers/stripe.ts`

Billing surfaces remain stable:
- `lib/services/billing.service.ts` (provider-agnostic orchestration + reconciliation)
- `lib/loaders/billing.loader.ts`, `lib/actions/billing.actions.ts`
- `/app/api/v1/billing/*` (provider-gated routes)
- `/app/app/(workspace)/billing` UI

## Schema changes (DB)
### Assets
Current `assets` table is close to provider-agnostic (`bucket`, `objectKey`, `contentType`, owner/org).
We should add:
- `provider` (`"gcs"|"s3"|"supabase"`) to support multi-provider migrations and debugging
- `externalId` / `storageKey` optional (Supabase object path vs S3 key; can still use `objectKey`)

Files:
- `packages/cli/src/core/generate/schema-edit.ts` (assets table upsert)
- `packages/cli/src/core/modules/core-db-state.module.ts` (if it writes assets schema directly)
- `apps/*/lib/db/schema.ts` generated output via baseline

### Billing
Current `billing_subscriptions.provider` already exists; keep it and ensure:
- Stripe uses `provider="stripe"` and stores `providerSubscriptionId` (Stripe subscription id)
- Customer mapping can support Stripe customer id (add column if missing)

Files:
- `packages/cli/src/core/generate/schema-edit.ts` (`billingCustomers`, `billingSubscriptions`)
- `packages/cli/src/core/modules/billing-*.module.ts`

## Env changes
### Storage
Add per-provider env schemas:
- GCS: `GCS_BUCKET`, `GCS_PROJECT_ID` (existing)
- S3: `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (and optional `AWS_ENDPOINT` for S3-compatible)
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

Files:
- new: `packages/cli/src/core/modules/storage-s3.module.ts`
- new: `packages/cli/src/core/modules/storage-supabase.module.ts`
- `packages/cli/src/core/modules/env-edit.ts` (ensure module env schemas merge)

### Billing
Add Stripe env schema:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_*` or a JSON plan registry like Dodo’s equivalent

Files:
- new: `packages/cli/src/core/modules/billing-stripe.module.ts`
- `packages/cli/src/core/modules/env-edit.ts`

## CLI changes (init/baseline/add)
### Interactive selection
`init` prompts must offer:
- Storage provider: none | gcs | s3 | supabase
- Billing provider: none | dodo | stripe

Files:
- `packages/cli/src/core/interactive/prompt-init.ts`
- `packages/cli/src/core/init/run-init.ts`
- `packages/cli/src/core/config.ts` default config writing

### Baseline modules
Add and register new modules:
- `storage-s3.module.ts`
- `storage-supabase.module.ts`
- `billing-stripe.module.ts`

Files:
- `packages/cli/src/core/modules/registry.ts`
- `packages/cli/src/core/modules/types.ts`
- `packages/cli/src/core/baseline/run-baseline.ts` (deps + activation)

## Doctor changes
Doctor must validate:
- enabled provider routes exist + disabled provider routes absent
- env schema includes provider keys
- deps parity includes provider deps
- migration drift journal ↔ files (already improving)

Files:
- `packages/cli/src/core/doctor/run-doctor.ts`

## UI + hooks
### Storage UI
Keep `/app/app/(workspace)/assets` UX stable; provider only changes the signed URL issuance and object path strategy.
Add (recommended):
- `lib/hooks/client/use-assets.client.ts` (TanStack Query list/delete + mutations) so client usage is standardized.

### Billing UI
Keep billing UI stable; render plan registry for selected provider.
Add (recommended):
- `lib/hooks/client/use-billing.client.ts` for portal/checkout actions (where client-side needed)

## Current gaps to fix during implementation
- **Storage service is not provider-agnostic** (GCS imported at top-level).
- **Config cannot select S3/Supabase**.
- **No Stripe module** (routes/env/schema/service).
- **Schema does not record asset provider**.
- **Hooks are not standardized per PRD** for storage/billing domains.

## Implementation order (safe + incremental)
1. Expand config typing for storage/billing provider options.
2. Add module stubs (`storage-s3`, `storage-supabase`, `billing-stripe`) with proper route gating + env schema wiring + deps.
3. Refactor generated app storage/billing services to provider boundary (factory + providers).
4. Update schema (`assets.provider` etc.) + migrations generation.
5. Add hooks/keys/mutations for storage + billing.
6. Extend doctor checks and docs runbooks for each provider.

