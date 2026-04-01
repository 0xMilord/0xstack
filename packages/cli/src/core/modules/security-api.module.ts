import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const securityApiModule: Module = {
  id: "security-api",
  install: async () => {},
  activate: async (ctx) => {
    // This is core: API guards exist even if no external routes are enabled yet.
    await ensureDir(path.join(ctx.projectRoot, "lib", "security"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "rules"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "(workspace)", "api-keys"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "api-keys.repo.ts"),
      `import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, isNull, and, desc, sql } from "drizzle-orm";

export async function findActiveApiKeysByPrefix(prefix: string) {
  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(5);
}

export async function listActiveApiKeysForOrg(orgId: string) {
  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt))
    .limit(200);
}

export async function insertApiKey(input: { id: string; orgId: string; name: string; prefix: string; hash: string }) {
  const rows = await db
    .insert(apiKeys)
    .values({ id: input.id, orgId: input.orgId, name: input.name, prefix: input.prefix, hash: input.hash })
    .returning();
  return rows[0] ?? null;
}

export async function revokeApiKey(input: { id: string; orgId: string }) {
  await db.execute(sql\`
    update api_keys set revoked_at = now()
    where id = \${input.id} and org_id = \${input.orgId} and revoked_at is null
  \`);
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "api-keys.service.ts"),
      `import crypto from "node:crypto";
import { findActiveApiKeysByPrefix, insertApiKey, listActiveApiKeysForOrg, revokeApiKey } from "@/lib/repos/api-keys.repo";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function verifyApiKey(key: string): Promise<boolean> {
  // Expected format: any string >= 10 chars. We use prefix for lookup.
  const prefix = key.slice(0, 8);
  if (!prefix || prefix.length < 4) return false;
  const candidates = await findActiveApiKeysByPrefix(prefix);
  const hash = sha256Hex(key);
  return candidates.some((c: any) => typeof c.hash === "string" && safeEqual(c.hash, hash));
}

export async function apiKeysService_listForOrg(orgId: string) {
  return await listActiveApiKeysForOrg(orgId);
}

export async function apiKeysService_createForOrg(input: { orgId: string; name: string }) {
  const id = crypto.randomUUID();
  // 0xstack_<prefix>.<secret>
  const secret = crypto.randomBytes(24).toString("base64url");
  const prefix = crypto.randomBytes(4).toString("hex"); // 8 chars
  const key = \`0xstack_\${prefix}.\${secret}\`;
  const hash = sha256Hex(key);
  const row = await insertApiKey({ id, orgId: input.orgId, name: input.name, prefix, hash });
  return { row, key };
}

export async function apiKeysService_revokeForOrg(input: { orgId: string; id: string }) {
  await revokeApiKey({ orgId: input.orgId, id: input.id });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "security", "api.ts"),
      `import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { verifyApiKey } from "@/lib/services/api-keys.service";

type RateLimit = { max: number; windowMs: number };
const DEFAULT_LIMIT: RateLimit = { max: 60, windowMs: 60_000 };

const buckets = new Map<string, { resetAt: number; count: number }>();

function keyFromRequest(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "";
  return crypto.createHash("sha256").update(ip + "|" + apiKey).digest("hex");
}

export async function guardApiRequest(req: Request, limit: RateLimit = DEFAULT_LIMIT) {
  // API-key auth (enterprise baseline)
  const header = req.headers.get("x-api-key") ?? req.headers.get("authorization");
  const key = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;
  if (!key || key.length < 10) throw apiError("UNAUTHORIZED", "Missing API key", 401);
  const ok =
    (env.API_KEY && key === env.API_KEY) ||
    (await verifyApiKey(key).catch(() => false));
  if (!ok) throw apiError("UNAUTHORIZED", "Invalid API key", 401);

  // Rate limiting (durable when Upstash env is present; safe fallback for dev)
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit.max, \`\${Math.max(1, Math.round(limit.windowMs / 1000))} s\`),
      analytics: true,
      prefix: "0xstack:rl",
    });
    const id = keyFromRequest(req);
    const res = await ratelimit.limit(id);
    if (!res.success) throw apiError("RATE_LIMITED", "Too many requests", 429);
    return;
  }

  const bucketKey = keyFromRequest(req);
  const now = Date.now();
  const b = buckets.get(bucketKey);
  if (!b || b.resetAt <= now) {
    buckets.set(bucketKey, { resetAt: now + limit.windowMs, count: 1 });
    return;
  }
  b.count += 1;
  if (b.count > limit.max) throw apiError("RATE_LIMITED", "Too many requests", 429);
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  const err = new Error(message) as Error & { status: number; code: string; details?: unknown };
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}

export function toApiErrorResponse(err: unknown, requestId: string) {
  const e = err as any;
  const status = typeof e?.status === "number" ? e.status : 500;
  const code = typeof e?.code === "string" ? e.code : "INTERNAL";
  const message = typeof e?.message === "string" ? e.message : "Internal error";
  const body: any = { code, message, requestId };
  if (e?.details) body.details = e.details;
  return Response.json(body, { status, headers: { "x-request-id": requestId } });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "api-keys.keys.ts"),
      `export const apiKeysKeys = {\n  all: [\"api-keys\"] as const,\n  org: (orgId: string) => [...apiKeysKeys.all, \"org\", orgId] as const,\n};\n`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "rules", "api-keys.rules.ts"),
      `import { z } from \"zod\";\n\nexport const createApiKeyInput = z.object({\n  name: z.string().min(2).max(80),\n});\n\nexport const revokeApiKeyInput = z.object({\n  id: z.string().min(1),\n});\n`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "api-keys.loader.ts"),
      `import { cache } from \"react\";\nimport { cookies } from \"next/headers\";\nimport { withServerCache, CACHE_TTL, cacheTags } from \"@/lib/cache\";\nimport { requireAuth } from \"@/lib/auth/server\";\nimport { getActiveOrgIdFromCookies } from \"@/lib/orgs/active-org\";\nimport { apiKeysService_listForOrg } from \"@/lib/services/api-keys.service\";\n\nconst loadApiKeysOrgCached = withServerCache(\n  async (orgId: string) => await apiKeysService_listForOrg(orgId),\n  {\n    key: (orgId: string) => [\"api-keys\", \"org\", orgId],\n    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],\n    revalidate: CACHE_TTL.DASHBOARD,\n  }\n);\n\nexport const loadApiKeysForActiveOrg = cache(async () => {\n  const viewer = await requireAuth();\n  const orgId = getActiveOrgIdFromCookies(await cookies());\n  if (!orgId) return { orgId: null, keys: [] as any[] };\n  // membership is enforced by the workspace layout guard; this is read-model only.\n  return { orgId, keys: await loadApiKeysOrgCached(orgId), viewer };\n});\n`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "api-keys.actions.ts"),
      `"use server";\n\nimport { cookies } from \"next/headers\";\nimport { requireAuth } from \"@/lib/auth/server\";\nimport { getActiveOrgIdFromCookies } from \"@/lib/orgs/active-org\";\nimport { orgsService_assertMember } from \"@/lib/services/orgs.service\";\nimport { revalidate } from \"@/lib/cache\";\nimport { createApiKeyInput, revokeApiKeyInput } from \"@/lib/rules/api-keys.rules\";\nimport { apiKeysService_createForOrg, apiKeysService_revokeForOrg } from \"@/lib/services/api-keys.service\";\n\nexport async function createApiKeyAction(input: unknown) {\n  const viewer = await requireAuth();\n  const orgId = getActiveOrgIdFromCookies(await cookies());\n  if (!orgId) throw new Error(\"no_active_org\");\n  await orgsService_assertMember({ userId: viewer.userId, orgId });\n  const data = createApiKeyInput.parse(input);\n  const created = await apiKeysService_createForOrg({ orgId, name: data.name });\n  revalidate.dashboard(viewer.userId);\n  return { ok: true as const, created };\n}\n\nexport async function revokeApiKeyAction(input: unknown) {\n  const viewer = await requireAuth();\n  const orgId = getActiveOrgIdFromCookies(await cookies());\n  if (!orgId) throw new Error(\"no_active_org\");\n  await orgsService_assertMember({ userId: viewer.userId, orgId });\n  const data = revokeApiKeyInput.parse(input);\n  await apiKeysService_revokeForOrg({ orgId, id: data.id });\n  revalidate.dashboard(viewer.userId);\n  return { ok: true as const };\n}\n`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "(workspace)", "api-keys", "page.tsx"),
      `import { loadApiKeysForActiveOrg } from \"@/lib/loaders/api-keys.loader\";\nimport { createApiKeyAction, revokeApiKeyAction } from \"@/lib/actions/api-keys.actions\";\nimport { Input } from \"@/components/ui/input\";\nimport { Card, CardContent, CardHeader, CardTitle } from \"@/components/ui/card\";\nimport { buttonVariants } from \"@/components/ui/button\";\n\nexport default async function Page() {\n  const { orgId, keys } = await loadApiKeysForActiveOrg();\n\n  return (\n    <main className=\"mx-auto max-w-5xl space-y-6\">\n      <header className=\"space-y-2\">\n        <h1 className=\"text-2xl font-semibold\">API keys</h1>\n        <p className=\"text-sm text-muted-foreground\">Keys are org-scoped. Secrets are only shown once on creation.</p>\n      </header>\n\n      <Card>\n        <CardHeader>\n          <CardTitle className=\"text-base\">Create key</CardTitle>\n        </CardHeader>\n        <CardContent>\n          {!orgId ? (\n            <p className=\"text-sm text-muted-foreground\">Select an organization first.</p>\n          ) : (\n            <form\n              className=\"flex gap-2\"\n              action={async (fd) => {\n                \"use server\";\n                await createApiKeyAction({ name: String(fd.get(\"name\") ?? \"\") });\n              }}\n            >\n              <Input name=\"name\" placeholder=\"CI key\" minLength={2} required />\n              <button className={buttonVariants({ variant: \"secondary\" })} type=\"submit\">\n                Create\n              </button>\n            </form>\n          )}\n        </CardContent>\n      </Card>\n\n      <Card>\n        <CardHeader>\n          <CardTitle className=\"text-base\">Active keys</CardTitle>\n        </CardHeader>\n        <CardContent className=\"space-y-3 text-sm\">\n          {keys.length ? (\n            keys.map((k: any) => (\n              <div key={k.id} className=\"flex items-center justify-between gap-3 rounded-md border p-3\">\n                <div>\n                  <p className=\"font-medium\">{k.name}</p>\n                  <p className=\"text-muted-foreground font-mono text-xs\">{k.prefix}…</p>\n                </div>\n                <form\n                  action={async () => {\n                    \"use server\";\n                    await revokeApiKeyAction({ id: String(k.id) });\n                  }}\n                >\n                  <button className={buttonVariants({ variant: \"outline\" })} type=\"submit\">\n                    Revoke\n                  </button>\n                </form>\n              </div>\n            ))\n          ) : (\n            <p className=\"text-muted-foreground\">No active keys yet.</p>\n          )}\n        </CardContent>\n      </Card>\n\n      <p className=\"text-xs text-muted-foreground\">Tip: external routes accept x-api-key or Authorization: Bearer &lt;key&gt;.</p>\n    </main>\n  );\n}\n`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

