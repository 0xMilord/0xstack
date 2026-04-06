import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const jobsModule: Module = {
  id: "jobs",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = !!ctx.modules.jobs?.enabled;
    const route = "app/api/v1/jobs/reconcile/route.ts";
    if (!enabled) {
      await backupAndRemove(ctx.projectRoot, route);
      await backupAndRemove(ctx.projectRoot, "lib/jobs/reconcile.ts");
      return;
    }
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "jobs", "reconcile"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "jobs"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "jobs", "reconcile.ts"),
      `import { webhookLedgerService_list, webhookLedgerService_replay } from "@/lib/services/webhook-ledger.service";
\nexport async function jobs_runReconcile() {
  // Production baseline: replay recent provider webhooks into durable read models.
  // Today we support "dodo" (billing) replay. Extend here for other providers.
  const rows = await webhookLedgerService_list({ provider: "dodo", limit: 50 });
  let replayed = 0;
  for (const r of rows as any[]) {
    const res = await webhookLedgerService_replay({ provider: String(r.provider), eventId: String(r.eventId) });
    if ((res as any)?.ok) replayed += 1;
  }
  return { attempted: rows.length, replayed };
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "jobs", "reconcile", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { jobs_runReconcile } from "@/lib/jobs/reconcile";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    // Auth: prefer job secret header, fall back to API key guard.
    // The secret must match JOB_SECRET env var for server-to-server calls.
    const h = await headers();
    const secret = h.get("x-job-secret");
    const expectedSecret = process.env.JOB_SECRET;
    if (secret) {
      // Validate the secret against the expected value
      if (!expectedSecret || secret !== expectedSecret) {
        return NextResponse.json({ error: "invalid_job_secret" }, { status: 401, headers: { "x-request-id": requestId } });
      }
    } else {
      // No secret header — require API key authentication
      await guardApiRequest(req);
    }
    const res = await jobs_runReconcile();
    return NextResponse.json({ ok: true, requestId, ...res }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

