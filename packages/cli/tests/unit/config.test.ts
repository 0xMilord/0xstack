import { describe, it, expect } from "vitest";
import { ConfigSchema, applyProfile } from "../../src/core/config";

describe("ConfigSchema - Edge Cases", () => {
  it("rejects invalid URL for baseUrl", () => {
    expect(() => ConfigSchema.parse({ app: { baseUrl: "not-a-url" } })).toThrow();
  });

  it("rejects empty app name", () => {
    expect(() => ConfigSchema.parse({ app: { name: "" } })).toThrow();
  });

  it("accepts optional description", () => {
    const cfg = ConfigSchema.parse({ app: { name: "Test", description: "A test app" } });
    expect(cfg.app.description).toBe("A test app");
  });

  it("rejects invalid billing provider", () => {
    expect(() => ConfigSchema.parse({ modules: { billing: "paypal" } })).toThrow();
  });

  it("rejects invalid storage provider", () => {
    expect(() => ConfigSchema.parse({ modules: { storage: "azure" } })).toThrow();
  });

  it("rejects invalid email provider", () => {
    expect(() => ConfigSchema.parse({ modules: { email: "sendgrid" } })).toThrow();
  });

  it("rejects invalid auth provider", () => {
    expect(() => ConfigSchema.parse({ modules: { auth: "next-auth" } })).toThrow();
  });

  it("rejects invalid envMode", () => {
    expect(() => ConfigSchema.parse({ app: { envMode: "loose" } })).toThrow();
  });

  it("rejects invalid job driver", () => {
    expect(() => ConfigSchema.parse({ modules: { jobs: { enabled: true, driver: "bullmq" } } })).toThrow();
  });

  it("accepts valid job driver inngest", () => {
    const cfg = ConfigSchema.parse({ modules: { jobs: { enabled: true, driver: "inngest" } } });
    expect(cfg.modules.jobs.driver).toBe("inngest");
  });

  it("accepts valid job driver cron-only", () => {
    const cfg = ConfigSchema.parse({ modules: { jobs: { enabled: true, driver: "cron-only" } } });
    expect(cfg.modules.jobs.driver).toBe("cron-only");
  });

  it("accepts observability with only sentry", () => {
    const cfg = ConfigSchema.parse({ modules: { observability: { sentry: true } } });
    expect(cfg.modules.observability.sentry).toBe(true);
  });

  it("accepts observability with sentry disabled", () => {
    const cfg = ConfigSchema.parse({ modules: { observability: { sentry: false } } });
    expect(cfg.modules.observability.sentry).toBe(false);
  });

  it("accepts full profile configuration", () => {
    const cfg = ConfigSchema.parse({
      app: { name: "FullApp", description: "Full app", baseUrl: "https://full.com" },
      modules: {
        orgs: true,
        billing: "stripe",
        storage: "s3",
        email: "resend",
        cache: true,
        pwa: true,
        seo: true,
        blogMdx: true,
        observability: { sentry: true },
        jobs: { enabled: true, driver: "inngest" },
      },
      profiles: {
        production: { modules: { billing: "stripe", seo: true } },
        staging: { modules: { billing: "dodo", observability: { sentry: true } } },
      },
    });
    expect(cfg.modules.billing).toBe("stripe");
    expect(cfg.modules.storage).toBe("s3");
    expect(cfg.profiles?.production?.modules?.billing).toBe("stripe");
  });

  it("accepts minimal config with only app name", () => {
    const cfg = ConfigSchema.parse({ app: { name: "Minimal" } });
    expect(cfg.app.name).toBe("Minimal");
    expect(cfg.modules.orgs).toBe(true);
  });
});

describe("applyProfile - Edge Cases", () => {
  it("returns same config when profile is empty object", () => {
    const cfg = ConfigSchema.parse({ profiles: { empty: { modules: {} } } });
    const result = applyProfile(cfg, "empty");
    expect(result.modules.billing).toBe(false);
  });

  it("merges partial observability config", () => {
    const cfg = ConfigSchema.parse({
      modules: { observability: { sentry: false } },
      profiles: { staging: { modules: { observability: { sentry: true } } } },
    });
    const result = applyProfile(cfg, "staging");
    expect(result.modules.observability.sentry).toBe(true);
  });

  it("merges partial jobs config", () => {
    const cfg = ConfigSchema.parse({
      modules: { jobs: { enabled: false, driver: "cron-only" } },
      profiles: { staging: { modules: { jobs: { enabled: true } } } },
    });
    const result = applyProfile(cfg, "staging");
    expect(result.modules.jobs.enabled).toBe(true);
    expect(result.modules.jobs.driver).toBe("cron-only"); // Preserved
  });

  it("overrides billing from false to dodo", () => {
    const cfg = ConfigSchema.parse({
      profiles: { full: { modules: { billing: "dodo" } } },
    });
    const result = applyProfile(cfg, "full");
    expect(result.modules.billing).toBe("dodo");
  });

  it("overrides billing from dodo to stripe", () => {
    const cfg = ConfigSchema.parse({
      modules: { billing: "dodo" },
      profiles: { stripe: { modules: { billing: "stripe" } } },
    });
    const result = applyProfile(cfg, "stripe");
    expect(result.modules.billing).toBe("stripe");
  });

  it("does not affect non-profile modules", () => {
    const cfg = ConfigSchema.parse({
      modules: { seo: false, blogMdx: false },
      profiles: { blog: { modules: { blogMdx: true } } },
    });
    const result = applyProfile(cfg, "blog");
    expect(result.modules.blogMdx).toBe(true);
    expect(result.modules.seo).toBe(false); // Unchanged
  });
});
