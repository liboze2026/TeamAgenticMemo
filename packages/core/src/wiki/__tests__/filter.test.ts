import { describe, it, expect } from "vitest";
import { filterByStack, filterByAge } from "../filter.js";
import type { RawWikiItem } from "@teamagent/ports";

function makeItem(overrides: Partial<RawWikiItem> = {}): RawWikiItem {
  return {
    sourceType: "rss",
    sourceUrl: "https://example.com/item/1",
    title: "React 18 Released",
    content: "React 18 includes concurrent rendering features.",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    sourceId: "rss-001",
    ...overrides,
  };
}

describe("filterByStack", () => {
  it("returns true when stack item matches title (case-insensitive)", () => {
    const item = makeItem({ title: "TypeScript 5.5 Announcement" });
    expect(filterByStack(item, ["typescript"])).toBe(true);
  });

  it("returns true when stack item matches content (case-insensitive)", () => {
    const item = makeItem({ content: "New features in React 19" });
    expect(filterByStack(item, ["REACT"])).toBe(true);
  });

  it("returns false when no stack item matches", () => {
    const item = makeItem({ title: "Rust 2024 Edition", content: "Rust improvements" });
    expect(filterByStack(item, ["typescript", "react", "vue"])).toBe(false);
  });

  it("returns true when any of multiple stack items match", () => {
    const item = makeItem({ title: "Vite 5 released", content: "New bundling" });
    expect(filterByStack(item, ["react", "vite", "svelte"])).toBe(true);
  });

  it("returns false for empty stack", () => {
    const item = makeItem({ title: "React 18 Released" });
    expect(filterByStack(item, [])).toBe(false);
  });

  it("does substring match (not exact word)", () => {
    const item = makeItem({ title: "typescript-eslint plugin" });
    expect(filterByStack(item, ["typescript"])).toBe(true);
  });
});

describe("filterByAge", () => {
  it("returns true for item published recently (within maxAgeDays)", () => {
    const recentDate = new Date(Date.now() - 10 * 86_400_000); // 10 days ago
    const item = makeItem({ publishedAt: recentDate });
    expect(filterByAge(item, 180)).toBe(true);
  });

  it("returns false for item older than maxAgeDays", () => {
    const oldDate = new Date(Date.now() - 200 * 86_400_000); // 200 days ago
    const item = makeItem({ publishedAt: oldDate });
    expect(filterByAge(item, 180)).toBe(false);
  });

  it("defaults maxAgeDays to 180", () => {
    const recentDate = new Date(Date.now() - 90 * 86_400_000); // 90 days ago
    const item = makeItem({ publishedAt: recentDate });
    expect(filterByAge(item)).toBe(true);
  });

  it("returns false for item exactly at the boundary + 1 day", () => {
    const borderDate = new Date(Date.now() - 181 * 86_400_000);
    const item = makeItem({ publishedAt: borderDate });
    expect(filterByAge(item, 180)).toBe(false);
  });

  it("returns true for item published just now", () => {
    const item = makeItem({ publishedAt: new Date() });
    expect(filterByAge(item, 1)).toBe(true);
  });
});
