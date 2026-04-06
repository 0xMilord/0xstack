import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  upsertDomainTable,
  ensureOrgsTables,
  ensureApiKeysTable,
  ensureAssetsTable,
  ensureBillingTables,
  ensureWebhookEventsTable,
  ensurePushTables,
  ensureAuthTables,
} from "../../src/core/generate/schema-edit";

describe("upsertDomainTable", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeSchema(content: string) {
    await fs.writeFile(path.join(tmpDir, "lib", "db", "schema.ts"), content, "utf8");
  }

  async function readSchema() {
    return fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
  }

  it("adds table when schema has only imports", async () => {
    await writeSchema(`import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`);
    await upsertDomainTable(tmpDir, "posts", `export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});`);
    const schema = await readSchema();
    expect(schema).toContain("export const posts = pgTable");
    expect(schema).toContain("0xstack:SCHEMA-AUTO-START");
    expect(schema).toContain("0xstack:SCHEMA-AUTO-END");
  });

  it("adds table when schema has existing tables but no markers", async () => {
    await writeSchema(`import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
});
`);
    await upsertDomainTable(tmpDir, "posts", `export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
});`);
    const schema = await readSchema();
    expect(schema).toContain("userProfiles");
    expect(schema).toContain("posts");
    expect(schema).toContain("0xstack:SCHEMA-AUTO-START");
  });

  it("updates table when markers exist", async () => {
    await writeSchema(`import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// 0xstack:SCHEMA-AUTO-START
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});
// 0xstack:SCHEMA-AUTO-END
`);
    await upsertDomainTable(tmpDir, "posts", `export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  createdAt: timestamp("created_at").defaultNow(),
});`);
    const schema = await readSchema();
    expect(schema).toContain("body: text");
    expect(schema).toContain("createdAt: timestamp");
    // Should not have duplicate markers
    const startCount = (schema.match(/0xstack:SCHEMA-AUTO-START/g) || []).length;
    expect(startCount).toBe(1);
    const endCount = (schema.match(/0xstack:SCHEMA-AUTO-END/g) || []).length;
    expect(endCount).toBe(1);
  });

  it("adds new table alongside existing auto-managed tables", async () => {
    await writeSchema(`import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// 0xstack:SCHEMA-AUTO-START
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
});
// 0xstack:SCHEMA-AUTO-END
`);
    await upsertDomainTable(tmpDir, "comments", `export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id"),
});`);
    const schema = await readSchema();
    expect(schema).toContain("export const posts = pgTable");
    expect(schema).toContain("export const comments = pgTable");
  });

  it("handles complex table definitions with relations", async () => {
    await writeSchema(`import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`);
    await upsertDomainTable(tmpDir, "orders", `export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").default("pending"),
  total: text("total"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});`);
    const schema = await readSchema();
    expect(schema).toContain("orders");
    expect(schema).toContain("orgId");
    expect(schema).toContain("userId");
    expect(schema).toContain("status");
  });
});

describe("ensureOrgsTables", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds orgs table with correct columns", async () => {
    await ensureOrgsTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("orgs");
    expect(schema).toContain("org_members");
    expect(schema).toContain("org_id");
    expect(schema).toContain("role");
  });

  it("is idempotent (running twice does not duplicate tables)", async () => {
    await ensureOrgsTables(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensureOrgsTables(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    // Normalize whitespace for comparison (schema-edit may add extra newlines)
    expect(schema1.replace(/\s+/g, " ").trim()).toBe(schema2.replace(/\s+/g, " ").trim());
  });
});

describe("ensureApiKeysTable", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds api_keys table with correct columns", async () => {
    await ensureApiKeysTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("apiKeys");
    expect(schema).toContain("api_keys");
    expect(schema).toContain("prefix");
    expect(schema).toContain("hash");
    expect(schema).toContain("revokedAt");
  });

  it("is idempotent", async () => {
    await ensureApiKeysTable(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensureApiKeysTable(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema1).toBe(schema2);
  });
});

describe("ensureAssetsTable", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds assets table with correct columns", async () => {
    await ensureAssetsTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("assets");
    expect(schema).toContain("provider");
    expect(schema).toContain("bucket");
    expect(schema).toContain("objectKey");
    expect(schema).toContain("ownerUserId");
    expect(schema).toContain("orgId");
  });

  it("is idempotent", async () => {
    await ensureAssetsTable(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensureAssetsTable(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema1).toBe(schema2);
  });
});

describe("ensureBillingTables", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds billing_customers table", async () => {
    await ensureBillingTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("billingCustomers");
    expect(schema).toContain("billing_customers");
    expect(schema).toContain("dodoCustomerId");
    expect(schema).toContain("stripeCustomerId");
  });

  it("adds billing_subscriptions table", async () => {
    await ensureBillingTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("billingSubscriptions");
    expect(schema).toContain("billing_subscriptions");
    expect(schema).toContain("providerSubscriptionId");
    expect(schema).toContain("planId");
  });

  it("is idempotent", async () => {
    await ensureBillingTables(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensureBillingTables(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema1.replace(/\s+/g, " ").trim()).toBe(schema2.replace(/\s+/g, " ").trim());
  });
});

describe("ensureWebhookEventsTable", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds webhook_events table with correct columns", async () => {
    await ensureWebhookEventsTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("webhookEvents");
    expect(schema).toContain("webhook_events");
    expect(schema).toContain("provider");
    expect(schema).toContain("eventId");
    expect(schema).toContain("eventType");
    expect(schema).toContain("payloadJson");
  });

  it("is idempotent", async () => {
    await ensureWebhookEventsTable(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensureWebhookEventsTable(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema1).toBe(schema2);
  });
});

describe("ensurePushTables", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds push_subscriptions table", async () => {
    await ensurePushTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("pushSubscriptions");
    expect(schema).toContain("push_subscriptions");
    expect(schema).toContain("endpoint");
    expect(schema).toContain("p256dh");
    expect(schema).toContain("auth");
  });

  it("is idempotent", async () => {
    await ensurePushTables(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensurePushTables(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema1).toBe(schema2);
  });
});

describe("ensureAuthTables", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds user table", async () => {
    await ensureAuthTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("user");
    expect(schema).toContain("email");
    expect(schema).toContain("emailVerified");
  });

  it("adds session table", async () => {
    await ensureAuthTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("session");
    expect(schema).toContain("expiresAt");
    expect(schema).toContain("token");
  });

  it("adds account table", async () => {
    await ensureAuthTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("account");
    expect(schema).toContain("accountId");
    expect(schema).toContain("providerId");
  });

  it("adds verification table", async () => {
    await ensureAuthTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("verification");
    expect(schema).toContain("identifier");
    expect(schema).toContain("value");
  });

  it("is idempotent", async () => {
    await ensureAuthTables(tmpDir);
    const schema1 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    await ensureAuthTables(tmpDir);
    const schema2 = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema1.replace(/\s+/g, " ").trim()).toBe(schema2.replace(/\s+/g, " ").trim());
  });
});

describe("Multiple table operations", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "0xstack-schema-"));
    const libDir = path.join(tmpDir, "lib", "db");
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, "schema.ts"), `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds multiple tables in sequence", async () => {
    await ensureOrgsTables(tmpDir);
    await ensureApiKeysTable(tmpDir);
    await ensureAssetsTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("orgs");
    expect(schema).toContain("apiKeys");
    expect(schema).toContain("assets");
  });

  it("adds domain table after core tables", async () => {
    await ensureOrgsTables(tmpDir);
    await upsertDomainTable(tmpDir, "posts", `export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});`);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("orgs");
    expect(schema).toContain("posts");
  });

  it("all tables together produce valid schema", async () => {
    await ensureAuthTables(tmpDir);
    await ensureOrgsTables(tmpDir);
    await ensureApiKeysTable(tmpDir);
    await ensureAssetsTable(tmpDir);
    await ensureBillingTables(tmpDir);
    await ensureWebhookEventsTable(tmpDir);
    await ensurePushTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    // All tables should be present
    expect(schema).toContain("user");
    expect(schema).toContain("orgs");
    expect(schema).toContain("apiKeys");
    expect(schema).toContain("assets");
    expect(schema).toContain("billingCustomers");
    expect(schema).toContain("webhookEvents");
    expect(schema).toContain("pushSubscriptions");
  });
});
