import { describe, it, expect } from "vitest";
import { validateWikiItem } from "../validator.js";
import type { JudgedWikiItem } from "../types.js";

function makeJudged(overrides: Partial<JudgedWikiItem> = {}): JudgedWikiItem {
  return {
    sourceType: "rss",
    sourceUrl: "https://example.com/item/1",
    title: "React 18 Released",
    content: "React 18 includes concurrent rendering features.",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    sourceId: "rss-001",
    tldr: "React 18 adds concurrent features for better performance.",
    keywords: ["react", "concurrent", "rendering"],
    valuable: true,
    ...overrides,
  };
}

describe("validateWikiItem", () => {
  it("returns valid: true for a well-formed item", () => {
    const item = makeJudged();
    expect(validateWikiItem(item)).toEqual({ valid: true });
  });

  it("returns invalid when valuable is false (haiku rejected)", () => {
    const item = makeJudged({ valuable: false });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("haiku rejected");
  });

  it("uses rejectReason when valuable is false and rejectReason is set", () => {
    const item = makeJudged({ valuable: false, rejectReason: "too short" });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("too short");
  });

  it("returns invalid when tldr is too short (< 10 chars)", () => {
    const item = makeJudged({ tldr: "short" });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("tldr too short");
  });

  it("returns invalid when tldr is empty", () => {
    const item = makeJudged({ tldr: "" });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("tldr too short");
  });

  it("returns invalid when tldr is only whitespace", () => {
    const item = makeJudged({ tldr: "          " }); // 10 spaces but trim makes it empty
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("tldr too short");
  });

  it("returns invalid when keywords is empty array", () => {
    const item = makeJudged({ keywords: [] });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("no keywords");
  });

  it("returns invalid when sourceUrl is not a valid URL", () => {
    const item = makeJudged({ sourceUrl: "not-a-url" });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid url");
  });

  it("accepts https URLs", () => {
    const item = makeJudged({ sourceUrl: "https://blog.example.com/post/123" });
    expect(validateWikiItem(item)).toEqual({ valid: true });
  });

  it("rejects empty sourceUrl", () => {
    const item = makeJudged({ sourceUrl: "" });
    const result = validateWikiItem(item);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid url");
  });
});
