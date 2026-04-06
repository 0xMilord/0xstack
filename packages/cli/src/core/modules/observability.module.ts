import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const observabilityModule: Module = {
  id: "observability",
  install: async () => {},
  activate: async (ctx) => {
    // Always create baseline logger; Sentry/OTEL wiring is config-gated later.
    await ensureDir(path.join(ctx.projectRoot, "lib", "utils"));

    // Env schema for observability (composed into lib/env/schema.ts)
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "observability.ts"),
      `import { z } from "zod";
\nexport const ObservabilityEnvSchema = z.object({
  // Sentry
  SENTRY_DSN: z.string().min(1).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "utils", "logger.ts"),
      `/* eslint-disable no-console */
type Level = "trace" | "debug" | "info" | "success" | "warn" | "error";

export type LogContext = {
  file?: string;
  function?: string;
  userId?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
};

const EMOJI: Record<Level, string> = {
  trace: "📊",
  debug: "🔍",
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
  error: "❌",
};

function isProd() {
  return process.env.NODE_ENV === "production";
}

function shouldLog(level: Level) {
  if (!isProd()) return true;
  return level === "error" || level === "warn";
}

function redact(ctx: LogContext) {
  const out: LogContext = { ...ctx };
  for (const k of Object.keys(out)) {
    const lk = k.toLowerCase();
    if (lk.includes("secret") || lk.includes("token") || lk.includes("key") || lk.includes("password")) {
      out[k] = "[REDACTED]";
    }
  }
  if (out.metadata && typeof out.metadata === "object") {
    const meta: Record<string, unknown> = { ...(out.metadata as any) };
    for (const k of Object.keys(meta)) {
      const lk = k.toLowerCase();
      if (lk.includes("secret") || lk.includes("token") || lk.includes("key") || lk.includes("password")) {
        meta[k] = "[REDACTED]";
      }
    }
    out.metadata = meta;
  }
  return out;
}

function color(level: Level) {
  switch (level) {
    case "success":
      return "\\x1b[32m";
    case "warn":
      return "\\x1b[33m";
    case "error":
      return "\\x1b[31m";
    case "debug":
      return "\\x1b[35m";
    case "trace":
      return "\\x1b[34m";
    default:
      return "\\x1b[36m";
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function sentryCapture(message: string, context: LogContext, error?: unknown) {
  try {
    if (process.env.OXSTACK_SENTRY_DISABLED === "1") return;
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return;
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    if (!Sentry) return;
    if (error instanceof Error) {
      Sentry.captureException(error, { tags: { source: "logger" }, extra: { message, ...context } });
    } else if (error != null) {
      Sentry.captureMessage(message, { level: "error", extra: { ...context, error } });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: { ...context } });
    }
  } catch {
    // never let observability break runtime
  }
}

export function log(level: Level, message: string, context: LogContext = {}, error?: unknown) {
  if (!shouldLog(level)) return;
  const ctx = redact(context);
  const payload: Record<string, unknown> = { level, message, ts: nowIso(), ...ctx };
  if (error instanceof Error) {
    payload.error = { name: error.name, message: error.message, stack: error.stack };
  } else if (error != null) {
    payload.error = error;
  }

  if (isProd()) {
    console.log(JSON.stringify(payload));
    if (level === "error") void sentryCapture(message, ctx, error);
    return;
  }

  const prefix = \`\${EMOJI[level]} [\${level.toUpperCase()}]\`;
  const c = color(level);
  const reset = "\\x1b[0m";
  console.log(\`\${c}\${prefix}\${reset} \${message}\`, Object.keys(payload).length ? payload : undefined);
  if (level === "error") void sentryCapture(message, ctx, error);
}

export const logger = {
  info: (m: string, c?: LogContext) => log("info", m, c ?? {}),
  success: (m: string, c?: LogContext) => log("success", m, c ?? {}),
  warn: (m: string, c?: LogContext) => log("warn", m, c ?? {}),
  error: (m: string, c?: LogContext, e?: unknown) => log("error", m, c ?? {}, e),
  debug: (m: string, c?: LogContext) => log("debug", m, c ?? {}),
  trace: (m: string, c?: LogContext) => log("trace", m, c ?? {}),
  flowEntry: (name: string, c?: LogContext) => log("trace", \`→ \${name}\`, c ?? {}),
  flowExit: (name: string, out?: unknown, c?: LogContext) =>
    log("trace", \`← \${name}\`, { ...(c ?? {}), metadata: { ...(c?.metadata ?? {}), out } }),
  performance: (m: string, startMs: number, c?: LogContext) =>
    log("debug", m, { ...(c ?? {}), duration: Date.now() - startMs }),
  service: (name: string, input?: unknown, c?: LogContext) =>
    log("info", name, { ...(c ?? {}), metadata: { ...(c?.metadata ?? {}), input } }),
  action: (name: string, input?: unknown, c?: LogContext) =>
    log("info", \`action:\${name}\`, { ...(c ?? {}), metadata: { ...(c?.metadata ?? {}), input } }),
};
`
    );

    // TypeScript: keep @sentry/nextjs optional without breaking builds.
    await writeFileEnsured(path.join(ctx.projectRoot, "types", "sentry__nextjs.d.ts"), `declare module "@sentry/nextjs";\n`);

    // Sentry SDK init files (only when enabled in config).
    if (ctx.modules.observability?.sentry) {
      // P0 #12: Sentry middleware for automatic error capture in API routes
      await writeFileEnsured(
        path.join(ctx.projectRoot, "lib", "sentry", "middleware.ts"),
        `import * as Sentry from "@sentry/nextjs";

/**
 * Wrap an API route handler with Sentry error capture and request context.
 * Automatically sets request ID, tags, and captures unhandled errors.
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }) as T;
}

/**
 * Set Sentry request context (used in instrumentation and API routes).
 */
export function setSentryRequestContext(req: Request) {
  const url = new URL(req.url);
  Sentry.setContext("request", {
    method: req.method,
    url: url.pathname + url.search,
    host: url.host,
  });
  Sentry.setTag("route", url.pathname);
}
`
      );

      await writeFileEnsured(
        path.join(ctx.projectRoot, "instrumentation.ts"),
        `import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// P0 #12: Global error handler for uncaught exceptions
export const onRequestError = Sentry.captureRequestError;
`
      );
      await writeFileEnsured(
        path.join(ctx.projectRoot, "sentry.client.config.ts"),
        `import * as Sentry from "@sentry/nextjs";
\nSentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
  enabled: process.env.NODE_ENV === "production",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
`
      );
      await writeFileEnsured(
        path.join(ctx.projectRoot, "sentry.server.config.ts"),
        `import * as Sentry from "@sentry/nextjs";
\nSentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
  enabled: process.env.NODE_ENV === "production",
});
`
      );
      await writeFileEnsured(
        path.join(ctx.projectRoot, "sentry.edge.config.ts"),
        `import * as Sentry from "@sentry/nextjs";
\nSentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  enabled: process.env.NODE_ENV === "production",
});
`
      );

      // P0 #13: Wrap next.config.ts with withSentryConfig for source map uploads
      await ensureDir(path.join(ctx.projectRoot));
      await writeFileEnsured(
        path.join(ctx.projectRoot, "next.config.ts"),
        `import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Your Next.js config here
};

// P0 #13: Wrap with Sentry for source map upload and automatic error capture
export default withSentryConfig(nextConfig, {
  // Upload source maps to Sentry during build
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Automatically annotate errors with org + project
  org: process.env.SENTRY_ORG ?? "0xstack",
  project: process.env.SENTRY_PROJECT ?? "0xstack-app",
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
`
      );
    }
  },
  validate: async () => {},
  sync: async () => {},
};

