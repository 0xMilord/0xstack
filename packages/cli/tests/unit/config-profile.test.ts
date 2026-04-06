import { describe, it, expect } from "vitest";
import { applyProfile, ConfigSchema } from "../../src/core/config";

describe("applyProfile", () => {
  it("returns the same config when profile is missing", () => {
    const cfg = ConfigSchema.parse({});
    expect(applyProfile(cfg, "full")).toEqual(cfg);
  });

  it("merges profile module patch into modules", () => {
    const cfg = ConfigSchema.parse({
      profiles: {
        full: {
          modules: {
            seo: true,
            blogMdx: true,
            billing: "dodo",
          },
        },
      },
    });
    const next = applyProfile(cfg, "full");
    expect(next.modules.seo).toBe(true);
    expect(next.modules.blogMdx).toBe(true);
    expect(next.modules.billing).toBe("dodo");
  });

  it("deep-merges observability and jobs", () => {
    const cfg = ConfigSchema.parse({
      modules: {
        observability: { sentry: false, otel: true },
        jobs: { enabled: false, driver: "cron-only" },
      },
      profiles: {
        staging: {
          modules: {
            observability: { sentry: true },
            jobs: { enabled: true, driver: "inngest" },
          },
        },
      },
    });
    const next = applyProfile(cfg, "staging");
    expect(next.modules.observability).toEqual({ sentry: true, otel: true });
    expect(next.modules.jobs).toEqual({ enabled: true, driver: "inngest" });
  });
});
