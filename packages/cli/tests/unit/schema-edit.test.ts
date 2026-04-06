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

  it("adds table when schema is empty", async () => {
    await writeSchema(`import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n`);
    await upsertDomainTable(tmpDir, "posts", `export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});`);
    const schema = await readSchema();
    expect(schema).toContain("export const posts = pgTable");
    expect(schema).toContain("0xstack:SCHEMA-AUTO-START");
  });

  it("updates table when exists", async () => {
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
});`);
    const schema = await readSchema();
    expect(schema).toContain("body: text");
    // Should not have duplicate markers
    const startCount = (schema.match(/0xstack:SCHEMA-AUTO-START/g) || []).length;
    expect(startCount).toBe(1);
  });

  it("adds new table alongside existing tables", async () => {
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

  it("adds orgs table", async () => {
    await ensureOrgsTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("orgs");
    expect(schema).toContain("org_members");
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

  it("adds api_keys table", async () => {
    await ensureApiKeysTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("apiKeys");
    expect(schema).toContain("api_keys");
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

  it("adds assets table", async () => {
    await ensureAssetsTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("assets");
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

  it("adds billing tables", async () => {
    await ensureBillingTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("billing_customers");
    expect(schema).toContain("billing_subscriptions");
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

  it("adds webhook_events table", async () => {
    await ensureWebhookEventsTable(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("webhook_events");
    expect(schema).toContain("webhookEvents");
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
    expect(schema).toContain("push_subscriptions");
    expect(schema).toContain("pushSubscriptions");
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

  it("adds auth tables (user, session, account, verification)", async () => {
    await ensureAuthTables(tmpDir);
    const schema = await fs.readFile(path.join(tmpDir, "lib", "db", "schema.ts"), "utf8");
    expect(schema).toContain("user");
    expect(schema).toContain("session");
    expect(schema).toContain("account");
    expect(schema).toContain("verification");
  });
});
