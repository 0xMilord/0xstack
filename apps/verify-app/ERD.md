

<!-- AUTO-GENERATED START -->
## Inventory

- Profile (computed): `full`
- Modules: `{"auth":"better-auth","orgs":true,"billing":"dodo","storage":"gcs","email":"resend","cache":true,"pwa":true,"seo":true,"blogMdx":true,"observability":{"sentry":false,"otel":false},"jobs":{"enabled":true,"driver":"cron-only"}}`

### Routes (detected)
- `page` /app/about/page.tsx
- `api` /app/api/auth/[...all]/route.ts
- `api` /app/api/v1/auth/signout/route.ts
- `api` /app/api/v1/auth/viewer/route.ts
- `api` /app/api/v1/billing/checkout/route.ts
- `api` /app/api/v1/billing/portal/route.ts
- `api` /app/api/v1/billing/webhook/route.ts
- `api` /app/api/v1/health/route.ts
- `api` /app/api/v1/jobs/reconcile/route.ts
- `api` /app/api/v1/pwa/push/send/route.ts
- `api` /app/api/v1/pwa/push/subscribe/route.ts
- `api` /app/api/v1/pwa/push/unsubscribe/route.ts
- `api` /app/api/v1/storage/assets/route.ts
- `api` /app/api/v1/storage/assets/[assetId]/route.ts
- `api` /app/api/v1/storage/sign-read/route.ts
- `api` /app/api/v1/storage/sign-upload/route.ts
- `api` /app/api/v1/webhooks/ledger/events/route.ts
- `api` /app/api/v1/webhooks/ledger/events/[provider]/[eventId]/replay/route.ts
- `page` /app/app/(workspace)/api-keys/page.tsx
- `page` /app/app/(workspace)/assets/page.tsx
- `page` /app/app/(workspace)/assets/[assetId]/page.tsx
- `page` /app/app/(workspace)/billing/page.tsx
- `page` /app/app/(workspace)/page.tsx
- `page` /app/app/(workspace)/pwa/page.tsx
- `page` /app/app/(workspace)/settings/page.tsx
- `page` /app/app/(workspace)/webhooks/page.tsx
- `page` /app/app/orgs/page.tsx
- `page` /app/billing/cancel/page.tsx
- `page` /app/billing/success/page.tsx
- `page` /app/blog/page.tsx
- `page` /app/blog/[slug]/page.tsx
- `page` /app/contact/page.tsx
- `page` /app/forgot-password/page.tsx
- `page` /app/get-started/page.tsx
- `page` /app/login/page.tsx
- `page` /app/page.tsx
- `page` /app/pricing/page.tsx
- `page` /app/privacy/page.tsx
- `page` /app/reset-password/page.tsx
- `api` /app/rss.xml/route.ts
- `page` /app/terms/page.tsx

## Entities

### `account`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"account_id" text NOT NULL`
- `"provider_id" text NOT NULL`
- `"user_id" text NOT NULL`
- `"access_token" text`
- `"refresh_token" text`
- `"id_token" text`
- `"access_token_expires_at" timestamp`
- `"refresh_token_expires_at" timestamp`
- `"scope" text`
- `"password" text`
- `"created_at" timestamp DEFAULT now() NOT NULL`
- `"updated_at" timestamp NOT NULL`

### `api_keys`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"org_id" text`
- `"name" text NOT NULL`
- `"prefix" text NOT NULL`
- `"hash" text NOT NULL`
- `"revoked_at" timestamp with time zone`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`

### `assets`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"owner_user_id" text`
- `"org_id" text`
- `"bucket" text NOT NULL`
- `"object_key" text NOT NULL`
- `"content_type" text`
- `"size_bytes" text`
- `"sha256" text`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`

### `billing_customers`

**Columns**

- `"user_id" text NOT NULL`
- `"dodo_customer_id" text NOT NULL`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`

### `billing_subscriptions`

**Columns**

- `"org_id" text`
- `"provider" text NOT NULL`
- `"provider_subscription_id" text NOT NULL`
- `"status" text NOT NULL`
- `"plan_id" text`
- `"current_period_end" timestamp with time zone`
- `"cancel_at_period_end" text`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`
- `"updated_at" timestamp with time zone DEFAULT now() NOT NULL`

### `org_members`

**Columns**

- `"org_id" text NOT NULL`
- `"user_id" text NOT NULL`
- `"role" text NOT NULL`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`

### `orgs`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"name" text NOT NULL`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`

### `push_subscriptions`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"user_id" text NOT NULL`
- `"endpoint" text NOT NULL`
- `"p256dh" text NOT NULL`
- `"auth" text NOT NULL`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`

### `session`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"expires_at" timestamp NOT NULL`
- `"token" text NOT NULL`
- `"created_at" timestamp DEFAULT now() NOT NULL`
- `"updated_at" timestamp NOT NULL`
- `"ip_address" text`
- `"user_agent" text`
- `"user_id" text NOT NULL`

### `user`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"name" text NOT NULL`
- `"email" text NOT NULL`
- `"email_verified" boolean DEFAULT false NOT NULL`
- `"image" text`
- `"created_at" timestamp DEFAULT now() NOT NULL`
- `"updated_at" timestamp DEFAULT now() NOT NULL`

### `user_profiles`

**Columns**

- `"user_id" text PRIMARY KEY NOT NULL`
- `"display_name" text`
- `"avatar_asset_id" text`
- `"created_at" timestamp with time zone DEFAULT now() NOT NULL`
- `"updated_at" timestamp with time zone DEFAULT now() NOT NULL`

### `verification`

**Columns**

- `"id" text PRIMARY KEY NOT NULL`
- `"identifier" text NOT NULL`
- `"value" text NOT NULL`
- `"expires_at" timestamp NOT NULL`
- `"created_at" timestamp DEFAULT now() NOT NULL`
- `"updated_at" timestamp DEFAULT now() NOT NULL`

### `webhook_events`

**Columns**

- `"provider" text NOT NULL`
- `"event_id" text NOT NULL`
- `"event_type" text NOT NULL`
- `"payload_json" text NOT NULL`
- `"received_at" timestamp with time zone DEFAULT now() NOT NULL`
<!-- AUTO-GENERATED END -->
