/* eslint-disable no-console */
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
      return "\x1b[32m";
    case "warn":
      return "\x1b[33m";
    case "error":
      return "\x1b[31m";
    case "debug":
      return "\x1b[35m";
    case "trace":
      return "\x1b[34m";
    default:
      return "\x1b[36m";
  }
}

function nowIso() {
  return new Date().toISOString();
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
    return;
  }

  const prefix = `${EMOJI[level]} [${level.toUpperCase()}]`;
  const c = color(level);
  const reset = "\x1b[0m";
  console.log(`${c}${prefix}${reset} ${message}`, Object.keys(payload).length ? payload : undefined);
}

export const logger = {
  info: (m: string, c?: LogContext) => log("info", m, c ?? {}),
  success: (m: string, c?: LogContext) => log("success", m, c ?? {}),
  warn: (m: string, c?: LogContext) => log("warn", m, c ?? {}),
  error: (m: string, c?: LogContext, e?: unknown) => log("error", m, c ?? {}, e),
  debug: (m: string, c?: LogContext) => log("debug", m, c ?? {}),
  trace: (m: string, c?: LogContext) => log("trace", m, c ?? {}),
  flowEntry: (name: string, c?: LogContext) => log("trace", `→ ${name}`, c ?? {}),
  flowExit: (name: string, out?: unknown, c?: LogContext) =>
    log("trace", `← ${name}`, { ...(c ?? {}), metadata: { ...(c?.metadata ?? {}), out } }),
  performance: (m: string, startMs: number, c?: LogContext) =>
    log("debug", m, { ...(c ?? {}), duration: Date.now() - startMs }),
  service: (name: string, input?: unknown, c?: LogContext) =>
    log("info", name, { ...(c ?? {}), metadata: { ...(c?.metadata ?? {}), input } }),
  action: (name: string, input?: unknown, c?: LogContext) =>
    log("info", `action:${name}`, { ...(c ?? {}), metadata: { ...(c?.metadata ?? {}), input } }),
};
