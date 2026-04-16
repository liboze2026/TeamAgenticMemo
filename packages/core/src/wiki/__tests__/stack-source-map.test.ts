import { describe, it, expect } from "vitest";
import { autoSubscribe, STACK_TO_SOURCES } from "../stack-source-map.js";

describe("autoSubscribe", () => {
  it("returns empty array for empty stack", () => {
    expect(autoSubscribe([])).toEqual([]);
  });

  it("returns sources for known packages", () => {
    const result = autoSubscribe(["react"]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.type === "github_release")).toBe(true);
  });

  it("deduplicates sources across packages", () => {
    // Both react and vue might share no sources, but anthropic/@anthropic-ai/sdk do
    const result = autoSubscribe(["@anthropic-ai/sdk", "anthropic"]);
    const keys = result.map((c) => JSON.stringify(c));
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("adds arxiv sources for AI packages", () => {
    const result = autoSubscribe(["openai"]);
    const hasArxiv = result.some((c) => c.type === "arxiv");
    expect(hasArxiv).toBe(true);
  });

  it("does NOT add arxiv for non-AI packages", () => {
    const result = autoSubscribe(["react", "typescript", "vite"]);
    const hasArxiv = result.some((c) => c.type === "arxiv");
    expect(hasArxiv).toBe(false);
  });

  it("adds arxiv for anthropic package", () => {
    const result = autoSubscribe(["anthropic"]);
    const hasArxiv = result.some((c) => c.type === "arxiv");
    expect(hasArxiv).toBe(true);
  });

  it("adds arxiv for langchain package", () => {
    const result = autoSubscribe(["langchain"]);
    const hasArxiv = result.some((c) => c.type === "arxiv");
    expect(hasArxiv).toBe(true);
  });

  it("ignores unknown packages without throwing", () => {
    expect(() => autoSubscribe(["unknown-pkg-xyz", "another-unknown"])).not.toThrow();
    expect(autoSubscribe(["unknown-pkg-xyz"])).toEqual([]);
  });

  it("returns multiple sources for a package with multiple configs", () => {
    // react has both github_release and rss
    const result = autoSubscribe(["react"]);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("STACK_TO_SOURCES has entries for typescript, react, vite", () => {
    expect(STACK_TO_SOURCES["typescript"]).toBeDefined();
    expect(STACK_TO_SOURCES["react"]).toBeDefined();
    expect(STACK_TO_SOURCES["vite"]).toBeDefined();
  });

  it("combines sources from multiple stack packages without duplicates", () => {
    const result1 = autoSubscribe(["react"]);
    const result2 = autoSubscribe(["typescript"]);
    const combined = autoSubscribe(["react", "typescript"]);
    expect(combined.length).toBe(result1.length + result2.length);
  });
});
