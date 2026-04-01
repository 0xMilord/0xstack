

<!-- AUTO-GENERATED START -->
# `lib/billing`

## Dodo runbook (production)
- Set `DODO_PAYMENTS_*` vars in your environment.
- `DODO_PAYMENTS_WEBHOOK_KEY` must match your Dodo webhook signing key.

## Plan registry
- Default plan uses `DODO_PAYMENTS_STARTER_PRICE_ID`.
- For multiple plans set `DODO_PAYMENTS_PLANS_JSON` (validated at runtime).

## Org scoping
- Checkout URLs include `org_id` so webhook reconciliation can map subscriptions to orgs.
- Subscription status is a durable read model in `billing_subscriptions` and is cached/tagged by org.

## Entry points (detected)

- `dodo.webhooks.ts`
- `plans.ts`
<!-- AUTO-GENERATED END -->
