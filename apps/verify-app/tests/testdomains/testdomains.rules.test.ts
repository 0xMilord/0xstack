import { describe, it, expect } from "vitest";
import { createTestdomainInput } from "@/lib/rules/testdomains.rules";

describe("testdomains rules", () => {
  it("validates create input", () => {
    expect(createTestdomainInput.parse({ name: "Hello" })).toEqual({ name: "Hello" });
  });
});
