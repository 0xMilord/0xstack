import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const jobsModule: Module = {
  id: "jobs",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = !!ctx.modules.jobs?.enabled;
    const driver = ctx.modules.jobs?.driver ?? "cron-only";
    const route = "app/api/v1/jobs/reconcile/route.ts";
    if (!enabled) {
      await backupAndRemove(ctx.projectRoot, route);
      await backupAndRemove(ctx.projectRoot, "lib/jobs/reconcile.ts");
      await backupAndRemove(ctx.projectRoot, "vercel.json");
      return;
    }
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "jobs", "reconcile"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "jobs"));

    // P0 #10: Reconcile ALL billing providers, not just dodo
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "jobs", "reconcile.ts"),
      `import { webhookLedgerService_list, webhookLedgerService_replay } from "@/lib/services/webhook-ledger.service";
import { ACTIVE_BILLING_PROVIDER } from "@/lib/billing/runtime";

export async function jobs_runReconcile() {
  // Reconcile recent webhooks for the active billing provider.
  // If both providers are active (migration), reconcile both.
  const providers = ACTIVE_BILLING_PROVIDER === "dodo" ? ["dodo"] :
                    ACTIVE_BILLING_PROVIDER === "stripe" ? ["stripe"] :
                    ["dodo", "stripe"];

  let totalAttempted = 0;
  let totalReplayed = 0;

  for (const provider of providers) {
    const rows = await webhookLedgerService_list({ provider, limit: 50 });
    for (const r of rows as any[]) {
      const res = await webhookLedgerService_replay({ provider: String(r.provider), eventId: String(r.eventId) });
      if ((res as any)?.ok && !(res as any)?.alreadyReplayed) totalReplayed += 1;
    }
    totalAttempted += rows.length;
  }

  return { attempted: totalAttempted, replayed: totalReplayed, providers };
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
    const h = await headers();
    const secret = h.get("x-job-secret");
    const expectedSecret = process.env.JOB_SECRET;
    if (secret) {
      if (!expectedSecret || secret !== expectedSecret) {
        return NextResponse.json({ error: "invalid_job_secret" }, { status: 401, headers: { "x-request-id": requestId } });
      }
    } else {
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

    // P0 #9: Generate scheduling mechanism based on driver
    if (driver === "cron-only") {
      // Generate vercel.json with cron schedule
      await writeFileEnsured(
        path.join(ctx.projectRoot, "vercel.json"),
        JSON.stringify({
          crons: [
            {
              path: "/api/v1/jobs/reconcile",
              schedule: "*/5 * * * *"  // Every 5 minutes
            }
          ]
        }, null, 2)
      );
    } else if (driver === "inngest") {
      // Generate Inngest client, function, and API route
      await ensureDir(path.join(ctx.projectRoot, "app", "api", "inngest"));
      await writeFileEnsured(
        path.join(ctx.projectRoot, "lib", "jobs", "inngest.ts"),
        `import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "0xstack",
  name: "0xstack Background Jobs",
});
`
      );
      await writeFileEnsured(
        path.join(ctx.projectRoot, "lib", "jobs", "inngest-functions.ts"),
        `import { inngest } from "@/lib/jobs/inngest";
import { jobs_runReconcile } from "@/lib/jobs/reconcile";

export const reconcileWebhooks = inngest.createFunction(
  { id: "reconcile-webhooks", name: "Reconcile Webhook Events" },
  { cron: "*/5 * * * *" },  // Every 5 minutes
  async ({ step }) => {
    return await step.run("reconcile", async () => {
      return await jobs_runReconcile();
    });
  }
);
`
      );
      await writeFileEnsured(
        path.join(ctx.projectRoot, "app", "api", "inngest", "route.ts"),
        `import { serve } from "inngest/next";
import { reconcileWebhooks } from "@/lib/jobs/inngest-functions";

export const { GET, POST, PUT } = serve({
  client: { id: "0xstack" },
  functions: [reconcileWebhooks],
});
`
      );
    }
  },
  validate: async () => {},
  sync: async () => {},
};

