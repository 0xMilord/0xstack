import type { MilordConfig } from "./config";

export function expectedDepsForConfig(cfg: MilordConfig) {
  const deps: string[] = [];
  const devDeps: string[] = [];

  // Always-required baseline (keep in sync with baseline `install module deps`).
  deps.push("zod", "drizzle-orm", "postgres", "better-auth", "@better-auth/drizzle-adapter");
  deps.push("@tanstack/react-query", "zustand", "next-themes");
  deps.push("@upstash/redis", "@upstash/ratelimit");
  devDeps.push("drizzle-kit", "vitest", "vite");

  if (cfg.modules.blogMdx) {
    deps.push("gray-matter", "next-mdx-remote", "remark-gfm", "remark-toc", "rehype-slug", "rehype-autolink-headings");
    devDeps.push("@tailwindcss/typography");
  }
  if (cfg.modules.seo) deps.push("schema-dts");
  if (cfg.modules.billing === "dodo") deps.push("@dodopayments/nextjs", "standardwebhooks");
  if (cfg.modules.billing === "stripe") deps.push("stripe");
  if (cfg.modules.storage === "gcs") deps.push("@google-cloud/storage");
  if (cfg.modules.storage === "s3") deps.push("@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner");
  if (cfg.modules.storage === "supabase") deps.push("@supabase/supabase-js");
  if (cfg.modules.email === "resend") deps.push("resend", "@react-email/components", "@react-email/render");
  if (cfg.modules.cache) deps.push("lru-cache");
  if (cfg.modules.pwa) deps.push("web-push", "idb");
  if (cfg.modules.observability?.sentry) deps.push("@sentry/nextjs");

  return {
    deps: Array.from(new Set(deps)).sort(),
    devDeps: Array.from(new Set(devDeps)).sort(),
  };
}

