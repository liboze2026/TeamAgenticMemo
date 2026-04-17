import { describe, it, expect } from "vitest";
import { formatInjection } from "../format.js";
import type { WikiHint } from "../format.js";

const sampleEntry: WikiHint = {
  tldr: "axios 1.x: AbortSignal natively supported, CancelToken deprecated",
  sourceType: "npm",
  publishedAt: new Date("2026-01-15T00:00:00Z"),
};

describe("formatInjection", () => {
  it("returns empty string for empty array", () => {
    expect(formatInjection([])).toBe("");
  });

  it("contains WIKI HINT header", () => {
    const result = formatInjection([sampleEntry]);
    expect(result).toContain("📚 [WIKI HINT");
  });

  it("contains tldr text", () => {
    const result = formatInjection([sampleEntry]);
    expect(result).toContain("axios 1.x: AbortSignal natively supported");
  });

  it("contains source type", () => {
    const result = formatInjection([sampleEntry]);
    expect(result).toContain("npm");
  });

  it("contains year-month of publishedAt", () => {
    const result = formatInjection([sampleEntry]);
    expect(result).toContain("2026-01");
  });

  it("ends with ---", () => {
    const result = formatInjection([sampleEntry]);
    expect(result.endsWith("---")).toBe(true);
  });

  it("renders multiple entries", () => {
    const second: WikiHint = {
      tldr: "Zustand v5: createStore API breaking change",
      sourceType: "github_release",
      publishedAt: new Date("2026-02-01T00:00:00Z"),
    };
    const result = formatInjection([sampleEntry, second]);
    expect(result).toContain("axios");
    expect(result).toContain("Zustand");
  });
});
