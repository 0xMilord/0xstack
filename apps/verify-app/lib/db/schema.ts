import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Better Auth core tables are generated via Better Auth CLI in baseline (no hand-rolled auth tables).
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  avatarAssetId: text("avatar_asset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 0xstack:BETTER-AUTH-EXPORTS
export * from "../auth/auth-schema";

// 0xstack:SCHEMA-AUTO-START






















export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable("org_members", {
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("org_members_org_id_user_id").on(t.orgId, t.userId),
}));

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  ownerUserId: text("owner_user_id"),
  orgId: text("org_id"),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  sizeBytes: text("size_bytes"),
  sha256: text("sha256"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingCustomers = pgTable("billing_customers", {
  userId: text("user_id").primaryKey(),
  dodoCustomerId: text("dodo_customer_id"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqStripe: uniqueIndex("billing_customers_stripe_customer_id").on(t.stripeCustomerId),
}));

export const billingSubscriptions = pgTable("billing_subscriptions", {
  orgId: text("org_id"),
  provider: text("provider").notNull(),
  providerSubscriptionId: text("provider_subscription_id").notNull(),
  status: text("status").notNull(),
  planId: text("plan_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: text("cancel_at_period_end"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("billing_subscriptions_provider_subscription_id").on(t.providerSubscriptionId),
}));

export const webhookEvents = pgTable("webhook_events", {
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("webhook_events_provider_event_id").on(t.provider, t.eventId),
}));

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("push_subscriptions_user_endpoint").on(t.userId, t.endpoint),
}));

export const testdomains = pgTable("testdomains", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  name: text("name").notNull(),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 0xstack:SCHEMA-AUTO-END
