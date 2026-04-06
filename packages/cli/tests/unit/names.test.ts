import { describe, it, expect } from "vitest";
import { toKebab, toCamel, toPascal, pluralize } from "../../src/core/generate/names";

describe("toKebab", () => {
  it("converts camelCase to kebab-case", () => {
    expect(toKebab("myDomain")).toBe("my-domain");
    expect(toKebab("simpleTest")).toBe("simple-test");
  });

  it("converts PascalCase to kebab-case", () => {
    expect(toKebab("MyDomain")).toBe("my-domain");
    expect(toKebab("SimpleTest")).toBe("simple-test");
  });

  it("converts spaces to kebab-case", () => {
    expect(toKebab("my domain")).toBe("my-domain");
    expect(toKebab("Simple Test")).toBe("simple-test");
  });

  it("handles already kebab-case input", () => {
    expect(toKebab("my-domain")).toBe("my-domain");
  });

  it("handles single word", () => {
    expect(toKebab("posts")).toBe("posts");
    expect(toKebab("Posts")).toBe("posts");
  });
});

describe("toCamel", () => {
  it("converts kebab-case to camelCase", () => {
    expect(toCamel("my-domain")).toBe("myDomain");
    expect(toCamel("simple-test")).toBe("simpleTest");
  });

  it("converts PascalCase to camelCase", () => {
    expect(toCamel("MyDomain")).toBe("myDomain");
  });

  it("handles single word", () => {
    expect(toCamel("posts")).toBe("posts");
  });
});

describe("toPascal", () => {
  it("converts kebab-case to PascalCase", () => {
    expect(toPascal("my-domain")).toBe("MyDomain");
    expect(toPascal("simple-test")).toBe("SimpleTest");
  });

  it("converts camelCase to PascalCase", () => {
    expect(toPascal("myDomain")).toBe("MyDomain");
  });

  it("handles single word", () => {
    expect(toPascal("posts")).toBe("Posts");
  });
});

describe("pluralize", () => {
  it("handles regular nouns by adding s", () => {
    expect(pluralize("post")).toBe("posts");
    expect(pluralize("domain")).toBe("domains");
  });

  it("handles already plural words", () => {
    expect(pluralize("posts")).toBe("posts");
  });

  it("handles single letter words", () => {
    expect(pluralize("a")).toBe("as");
  });
});
