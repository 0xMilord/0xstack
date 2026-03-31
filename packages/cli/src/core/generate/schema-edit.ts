import fs from "node:fs/promises";
import path from "node:path";

const START = "// 0xstack:SCHEMA-AUTO-START";
const END = "// 0xstack:SCHEMA-AUTO-END";

export async function ensureSchemaMarkers(projectRoot: string) {
  const schemaPath = path.join(projectRoot, "lib", "db", "schema.ts");
  let src = await fs.readFile(schemaPath, "utf8");
  if (src.includes(START) && src.includes(END)) return;
  src = `${src.trimEnd()}\n\n${START}\n${END}\n`;

  // Ensure core imports for generated tables exist.
  if (!src.includes(`from "drizzle-orm/pg-core"`)) {
    src = `import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";\n\n${src}`;
  } else if (!src.includes("uniqueIndex")) {
    src = src.replace(
      /import\s+\{\s*([^}]+)\s*\}\s+from\s+"drizzle-orm\/pg-core";/m,
      (m, inner) => {
        const parts = inner
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (!parts.includes("uniqueIndex")) parts.push("uniqueIndex");
        return `import { ${parts.join(", ")} } from "drizzle-orm/pg-core";`;
      }
    );
  }
  await fs.writeFile(schemaPath, src, "utf8");
}

export async function upsertDomainTable(projectRoot: string, tableName: string, tableSnippet: string) {
  const schemaPath = path.join(projectRoot, "lib", "db", "schema.ts");
  let src = await fs.readFile(schemaPath, "utf8");
  if (!src.includes(START) || !src.includes(END)) {
    await ensureSchemaMarkers(projectRoot);
    src = await fs.readFile(schemaPath, "utf8");
  }
  const startIdx = src.indexOf(START);
  const endIdx = src.indexOf(END);
  const before = src.slice(0, startIdx + START.length);
  const middle = src.slice(startIdx + START.length, endIdx);
  const after = src.slice(endIdx);

  // Remove any previous block for this table by export name.
  const exportRe = new RegExp(`\\nexport const ${tableName} = [\\s\\S]*?;\\n`, "g");
  const cleaned = middle.replace(exportRe, "\n");
  const nextMiddle = `${cleaned.trimEnd()}\n\n${tableSnippet.trim()}\n\n`;

  const next = `${before}\n${nextMiddle}${after}`;
  await fs.writeFile(schemaPath, next, "utf8");
}

export async function ensureWebhookEventsTable(projectRoot: string) {
  await upsertDomainTable(
    projectRoot,
    "webhookEvents",
    `export const webhookEvents = pgTable("webhook_events", {
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("webhook_events_provider_event_id").on(t.provider, t.eventId),
}));`
  );
}

export async function ensureApiKeysTable(projectRoot: string) {
  await upsertDomainTable(
    projectRoot,
    "apiKeys",
    `export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});`
  );
}

export async function ensureAssetsTable(projectRoot: string) {
  await upsertDomainTable(
    projectRoot,
    "assets",
    `export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  orgId: text("org_id"),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  sizeBytes: text("size_bytes"),
  sha256: text("sha256"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});`
  );
}

export async function ensureBillingTables(projectRoot: string) {
  await upsertDomainTable(
    projectRoot,
    "billingCustomers",
    `export const billingCustomers = pgTable("billing_customers", {
  userId: text("user_id").notNull(),
  dodoCustomerId: text("dodo_customer_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("billing_customers_dodo_customer_id").on(t.dodoCustomerId),
}));`
  );
  await upsertDomainTable(
    projectRoot,
    "billingSubscriptions",
    `export const billingSubscriptions = pgTable("billing_subscriptions", {
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
}));`
  );
}

export async function ensureOrgsTables(projectRoot: string) {
  await upsertDomainTable(
    projectRoot,
    "orgs",
    `export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});`
  );
  await upsertDomainTable(
    projectRoot,
    "orgMembers",
    `export const orgMembers = pgTable("org_members", {
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("org_members_org_id_user_id").on(t.orgId, t.userId),
}));`
  );
}

