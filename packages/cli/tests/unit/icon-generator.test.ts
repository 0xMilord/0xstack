import { describe, it, expect } from "vitest";
import { generateAppIcon, generateFaviconDataUrl } from "../../src/core/utils/icon-generator";

describe("generateAppIcon", () => {
  it("generates valid SVG for default theme", () => {
    const svg = generateAppIcon("TestApp", "default");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("xmlns");
  });

  it("generates valid SVG for corporate-blue theme", () => {
    const svg = generateAppIcon("MyApp", "corporate-blue");
    expect(svg).toContain("<svg");
  });

  it("generates valid SVG for amber theme", () => {
    const svg = generateAppIcon("App", "amber");
    expect(svg).toContain("<svg");
  });

  it("generates valid SVG for grass theme", () => {
    const svg = generateAppIcon("TestApp", "grass");
    expect(svg).toContain("<svg");
  });

  it("includes viewBox attribute", () => {
    const svg = generateAppIcon("TestApp", "default");
    expect(svg).toContain("viewBox");
  });

  it("uses first letter of app name in icon", () => {
    const svg = generateAppIcon("TestApp", "default");
    expect(svg).toContain(">T<"); // First letter
  });

  it("uses different gradient colors for different themes", () => {
    const defaultSvg = generateAppIcon("TestApp", "default");
    const amberSvg = generateAppIcon("TestApp", "amber");
    expect(defaultSvg).not.toBe(amberSvg);
  });
});

describe("generateFaviconDataUrl", () => {
  it("generates data URL starting with data:image", () => {
    const dataUrl = generateFaviconDataUrl("TestApp", "default");
    expect(dataUrl).toMatch(/^data:image\/svg\+xml/);
  });

  it("includes first letter of app name in SVG", () => {
    const dataUrl = generateFaviconDataUrl("MyApp", "default");
    const base64 = dataUrl.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    expect(decoded).toContain(">M<"); // First letter
  });

  it("generates different output for different themes", () => {
    const defaultUrl = generateFaviconDataUrl("TestApp", "default");
    const blueUrl = generateFaviconDataUrl("TestApp", "corporate-blue");
    expect(defaultUrl).not.toBe(blueUrl);
  });
});
