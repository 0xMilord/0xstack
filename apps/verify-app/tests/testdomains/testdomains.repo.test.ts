import { describe, it, expect } from "vitest";

describe("testdomains repo", () => {
  it("has basic exports", async () => {
    const mod = await import("@/lib/repos/testdomains.repo");
    expect(typeof mod.listTestdomain).toBe("function");
    expect(typeof mod.getTestdomainById).toBe("function");
  });
});
