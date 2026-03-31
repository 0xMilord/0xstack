import crypto from "node:crypto";
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
      limiter: Ratelimit.slidingWindow(limit.max, `${Math.max(1, Math.round(limit.windowMs / 1000))} s`),
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
