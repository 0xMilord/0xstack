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
    expect(devDeps).toContain("@tailwindcss/typography");
  });

  it("adds Dodo billing packages when billing is dodo", () => {
    const cfg = ConfigSchema.parse({ modules: { billing: "dodo" } });
    const { deps } = expectedDepsForConfig(cfg);
    expect(deps).toContain("@dodopayments/nextjs");
    expect(deps).toContain("standardwebhooks");
  });
});
