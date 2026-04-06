import { describe, it, expect } from "vitest";
import { expectedDepsForConfig } from "../../src/core/deps";
import { ConfigSchema } from "../../src/core/config";

describe("expectedDepsForConfig", () => {
  it("includes baseline deps and tooling", () => {
    const cfg = ConfigSchema.parse({});
    const { deps, devDeps } = expectedDepsForConfig(cfg);
    expect(deps).toEqual(
      expect.arrayContaining([
        "better-auth",
        "drizzle-orm",
        "next-themes",
        "postgres",
        "zod",
        "@tanstack/react-query",
        "@upstash/ratelimit",
        "@upstash/redis",
        "zustand",
      ])
    );
    expect(devDeps).toEqual(expect.arrayContaining(["drizzle-kit", "vite", "vitest"]));
  });

  it("adds blog + typography when blogMdx is on", () => {
    const cfg = ConfigSchema.parse({ modules: { blogMdx: true } });
    const { deps, devDeps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("remark-toc");
    expect(deps).toContain("gray-matter");
    expect(deps).toContain("next-mdx-remote");
    expect(deps).toContain("remark-gfm");
    expect(deps).toContain("rehype-slug");
    expect(deps).toContain("rehype-autolink-headings");
    expect(devDeps).toContain("@tailwindcss/typography");
  });

  it("adds Dodo billing packages when billing is dodo", () => {
    const cfg = ConfigSchema.parse({ modules: { billing: "dodo" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("@dodopayments/nextjs");
    expect(deps).toContain("standardwebhooks");
  });

  it("adds Stripe packages when billing is stripe", () => {
    const cfg = ConfigSchema.parse({ modules: { billing: "stripe" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("stripe");
    expect(deps).not.toContain("@dodopayments/nextjs");
  });

  it("adds GCS packages when storage is gcs", () => {
    const cfg = ConfigSchema.parse({ modules: { storage: "gcs" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("@google-cloud/storage");
  });

  it("adds S3 packages when storage is s3", () => {
    const cfg = ConfigSchema.parse({ modules: { storage: "s3" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("@aws-sdk/client-s3");
    expect(deps).toContain("@aws-sdk/s3-request-presigner");
  });

  it("adds Supabase packages when storage is supabase", () => {
    const cfg = ConfigSchema.parse({ modules: { storage: "supabase" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("@supabase/supabase-js");
  });

  it("adds Resend packages when email is resend", () => {
    const cfg = ConfigSchema.parse({ modules: { email: "resend" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("resend");
    expect(deps).toContain("@react-email/components");
    expect(deps).toContain("@react-email/render");
  });

  it("adds lru-cache when cache is enabled", () => {
    const cfg = ConfigSchema.parse({ modules: { cache: true } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("lru-cache");
  });

  it("adds PWA packages when pwa is enabled", () => {
    const cfg = ConfigSchema.parse({ modules: { pwa: true } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("web-push");
    expect(deps).toContain("idb");
  });

  it("adds Sentry when observability.sentry is enabled", () => {
    const cfg = ConfigSchema.parse({ modules: { observability: { sentry: true } } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("@sentry/nextjs");
  });

  it("adds schema-dts when SEO is enabled", () => {
    const cfg = ConfigSchema.parse({ modules: { seo: true } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("schema-dts");
  });

  it("does not duplicate deps across module combos", () => {
    const cfg = ConfigSchema.parse({
      modules: {
        billing: "dodo",
        storage: "gcs",
        email: "resend",
        pwa: true,
        seo: true,
        blogMdx: true,
        cache: true,
        observability: { sentry: true },
      },
    });
    const { deps } = expectedDepsForConfig(cfg);
    const unique = new Set(deps);
    expect(deps.length).toBe(unique.size);
  });

  it("returns sorted arrays", () => {
    const cfg = ConfigSchema.parse({
      modules: { billing: "dodo", storage: "gcs", seo: true },
    });
    const { deps, devDeps } = expectedDepsForConfig(cfg);
    expect(deps).toEqual([...deps].sort());
    expect(devDeps).toEqual([...devDeps].sort());
  });
});
