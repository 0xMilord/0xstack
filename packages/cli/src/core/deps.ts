import type { MilordConfig } from "./config";

export function expectedDepsForConfig(cfg: MilordConfig) {
  const deps: string[] = [];
  const devDeps: string[] = [];

  // Always-required baseline.
  deps.push("zod", "drizzle-orm", "postgres", "better-auth", "@better-auth/drizzle-adapter");
  deps.push("@tanstack/react-query", "zustand");
  deps.push("@upstash/redis", "@upstash/ratelimit");
  devDeps.push("drizzle-kit");

  if (cfg.modules.blogMdx) deps.push("gray-matter", "next-mdx-remote", "remark-gfm", "rehype-slug", "rehype-autolink-headings");
  if (cfg.modules.seo) deps.push("schema-dts");
  if (cfg.modules.billing === "dodo") deps.push("@dodopayments/nextjs", "standardwebhooks");
  if (cfg.modules.storage === "gcs") deps.push("@google-cloud/storage");
  if (cfg.modules.email === "resend") deps.push("resend", "@react-email/components", "@react-email/render");
  if (cfg.modules.cache) deps.push("lru-cache");
  if (cfg.modules.pwa) deps.push("web-push", "idb");
  if (cfg.modules.observability?.sentry) deps.push("@sentry/nextjs");

  return {
    deps: Array.from(new Set(deps)).sort(),
    devDeps: Array.from(new Set(devDeps)).sort(),
  };
}

