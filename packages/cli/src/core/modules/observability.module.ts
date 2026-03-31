import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const observabilityModule: Module = {
  id: "observability",
  install: async () => {},
  activate: async (ctx) => {
    // Always create baseline logger; Sentry/OTEL wiring is config-gated later.
    await ensureDir(path.join(ctx.projectRoot, "lib", "utils"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "utils", "logger.ts"),
      `type Level = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function redact(fields: LogFields) {
  const clone: LogFields = { ...fields };
  for (const k of Object.keys(clone)) {
    if (k.toLowerCase().includes("secret") || k.toLowerCase().includes("token") || k.toLowerCase().includes("key")) {
      clone[k] = "[REDACTED]";
    }
  }
  return clone;
}

export function log(level: Level, msg: string, fields: LogFields = {}) {
  const payload = { level, msg, ts: new Date().toISOString(), ...redact(fields) };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

