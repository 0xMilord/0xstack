import type { CAC } from "cac";
import { logger } from "../core/logger";

const LINES = [
  "Module ids for `0xstack add <module>`:",
  "",
  "  seo              — SEO (robots, sitemap, OG/Twitter, JSON-LD)",
  "  blogMdx          — MDX blog + RSS",
  "  billing          — alias → Dodo Payments",
  "  billing-dodo     — Dodo Payments",
  "  billing-stripe   — Stripe",
  "  storage          — alias → Google Cloud Storage",
  "  storage-gcs      — GCS signed URLs",
  "  storage-s3       — S3 presigned URLs",
  "  storage-supabase — Supabase Storage",
  "  email            — alias → Resend",
  "  email-resend     — Resend + templates",
  "  jobs             — cron-only jobs reconcile stub",
  "",
  "After adding, set env vars and run `0xstack doctor`.",
  "Reconfigure with: `0xstack wizard`",
];

export function registerModulesListCommand(cli: CAC) {
  cli.command("modules", "List module ids for `0xstack add`").action(() => {
    for (const line of LINES) logger.info(line);
  });
}
