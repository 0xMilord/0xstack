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
      return;
    }
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "jobs", "reconcile"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "jobs", "reconcile", "route.ts"),
      `import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST() {
  // Baseline: secret-gate job endpoint. Wire real driver (inngest/cron) later.
  const h = await headers();
  const secret = h.get("x-job-secret");
  if (!secret) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

