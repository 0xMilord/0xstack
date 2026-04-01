import fs from "node:fs/promises";
import path from "node:path";
import type { ModuleContext } from "./types";

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function requireFiles(root: string, label: string, files: string[], errors: string[]) {
  for (const f of files) {
    if (!(await fileExists(path.join(root, ...f.split("/"))))) {
      errors.push(`[${label}] missing ${f}`);
    }
  }
}

/**
 * PRD module lifecycle: validate enabled modules have expected surfaces (baseline smoke check).
 * Stricter full checks remain in `doctor`.
 */
export async function runConsolidatedModuleValidate(ctx: ModuleContext) {
  const root = ctx.projectRoot;
  const m = ctx.modules;
  const errors: string[] = [];

  if (m.seo) {
    await requireFiles(
      root,
      "seo",
      ["app/robots.ts", "app/sitemap.ts", "lib/seo/jsonld.ts", "lib/seo/runtime.ts"],
      errors
    );
  }

  if (m.blogMdx) {
    await requireFiles(
      root,
      "blogMdx",
      ["app/blog/page.tsx", "app/blog/[slug]/page.tsx", "app/rss.xml/route.ts", "lib/loaders/blog.loader.ts"],
      errors
    );
  }

  if (m.billing === "dodo" || m.billing === "stripe") {
    await requireFiles(
      root,
      "billing",
      [
        "app/api/v1/billing/checkout/route.ts",
        "app/api/v1/billing/portal/route.ts",
        "app/api/v1/billing/webhook/route.ts",
        "lib/services/billing.service.ts",
        "lib/billing/runtime.ts",
      ],
      errors
    );
    if (m.billing === "dodo") await requireFiles(root, "billing.dodo", ["lib/billing/dodo.webhooks.ts"], errors);
    if (m.billing === "stripe") await requireFiles(root, "billing.stripe", ["lib/billing/stripe.ts"], errors);
  }

  if (m.storage === "gcs" || m.storage === "s3" || m.storage === "supabase") {
    await requireFiles(
      root,
      "storage",
      [
        "lib/services/storage.service.ts",
        "lib/storage/runtime.ts",
        "lib/storage/provider.ts",
        "app/api/v1/storage/sign-upload/route.ts",
        "app/api/v1/storage/sign-read/route.ts",
      ],
      errors
    );
    if (m.storage === "gcs") await requireFiles(root, "storage.gcs", ["lib/storage/providers/gcs.ts"], errors);
    if (m.storage === "s3") await requireFiles(root, "storage.s3", ["lib/storage/providers/s3.ts"], errors);
    if (m.storage === "supabase") {
      await requireFiles(root, "storage.supabase", ["lib/storage/providers/supabase.ts"], errors);
    }
  }

  if (m.email === "resend") {
    await requireFiles(root, "email", ["lib/email/resend.ts", "lib/email/auth-emails.ts"], errors);
  }

  if (m.pwa) {
    await requireFiles(
      root,
      "pwa",
      ["public/manifest.webmanifest", "lib/pwa/register-sw.client.ts", "lib/env/pwa.ts"],
      errors
    );
  }

  if (m.jobs?.enabled) {
    await requireFiles(root, "jobs", ["app/api/v1/jobs/reconcile/route.ts", "lib/jobs/reconcile.ts"], errors);
  }

  if (m.observability?.sentry) {
    await requireFiles(
      root,
      "observability.sentry",
      ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"],
      errors
    );
  }

  if (errors.length) {
    throw new Error(`Module validate failed (${errors.length} issue(s)):\n- ${errors.join("\n- ")}`);
  }
}
