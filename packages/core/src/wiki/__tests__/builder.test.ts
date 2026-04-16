import { describe, it, expect } from "vitest";
import { buildWikiEntry } from "../builder.js";
import type { JudgedWikiItem } from "../types.js";

function makeJudged(overrides: Partial<JudgedWikiItem> = {}): JudgedWikiItem {
  return {
    sourceType: "github_release",
    sourceUrl: "https://github.com/facebook/react/releases/tag/v18.0.0",
    title: "React v18.0.0",
    content: "React 18 adds concurrent features.",
    publishedAt: new Date("2022-03-29T00:00:00Z"),
    sourceId: "github-react-v18.0.0",
    tldr: "React 18 introduces concurrent rendering for better UX.",
    keywords: ["react", "concurrent", "v18"],
    valuable: true,
    ...overrides,
  };
}

describe("buildWikiEntry", () => {
  it("builds a WikiEntry with correct fields", () => {
    const judged = makeJudged();
    const entry = buildWikiEntry(judged, "entry-001");

    expect(entry.id).toBe("entry-001");
    expect(entry.tldr).toBe(judged.tldr);
    expect(entry.keywords).toEqual(judged.keywords);
    expect(entry.sourceUrl).toBe(judged.sourceUrl);
    expect(entry.sourceType).toBe(judged.sourceType);
    expect(entry.sourceId).toBe(judged.sourceId);
    expect(entry.publishedAt).toBe(judged.publishedAt);
    expect(entry.title).toBe(judged.title);
  });

  it("uses the provided id", () => {
    const judged = makeJudged();
    const entry1 = buildWikiEntry(judged, "id-abc");
    const entry2 = buildWikiEntry(judged, "id-xyz");
    expect(entry1.id).toBe("id-abc");
    expect(entry2.id).toBe("id-xyz");
  });

  it("does not include the 'content' field (not part of WikiEntry)", () => {
    const judged = makeJudged();
    const entry = buildWikiEntry(judged, "e1");
    expect("content" in entry).toBe(false);
  });

  it("does not include the 'valuable' field", () => {
    const judged = makeJudged();
    const entry = buildWikiEntry(judged, "e1");
    expect("valuable" in entry).toBe(false);
  });

  it("correctly maps all sourceTypes", () => {
    for (const sourceType of ["github_release", "npm", "rss", "arxiv", "manual"] as const) {
      const judged = makeJudged({ sourceType });
      const entry = buildWikiEntry(judged, "e");
      expect(entry.sourceType).toBe(sourceType);
    }
  });
});
