import { describe, it, expect } from "vitest";
import { createTestdomainInput } from "@/lib/rules/testdomains.rules";

describe("testdomains actions", () => {
  it("create schema requires name", () => {
    expect(() => createTestdomainInput.parse({ id: "x" })).toThrow();
  });
});
