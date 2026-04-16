import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArxivSource } from "../arxiv-source.js";

// We test ArxivSource by mocking the rss-parser instance via prototype
// since vi.mock with ESM modules is tricky in this project setup.

const SAMPLE_FEED_ITEMS = [
  {
    title: "Attention Is All You Need",
    link: "https://arxiv.org/abs/1706.03762",
    guid: "https://arxiv.org/abs/1706.03762",
    contentSnippet: "We propose a new simple network architecture, the Transformer.",
    isoDate: "2024-01-15T00:00:00.000Z",
  },
  {
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    link: "https://arxiv.org/abs/1810.04805",
    guid: "https://arxiv.org/abs/1810.04805",
    contentSnippet: "We introduce BERT, a language representation model.",
    isoDate: "2024-02-01T00:00:00.000Z",
  },
  {
    title: "Old Paper",
    link: "https://arxiv.org/abs/0001.00001",
    guid: "https://arxiv.org/abs/0001.00001",
    contentSnippet: "Old content here.",
    isoDate: "2020-01-01T00:00:00.000Z",
  },
];

function makeMockedSource(items = SAMPLE_FEED_ITEMS) {
  const source = new ArxivSource();
  // Override the parser instance directly
  (source as unknown as { parser: { parseURL: ReturnType<typeof vi.fn> } }).parser = {
    parseURL: vi.fn().mockResolvedValue({ items }),
  };
  return source;
}

describe("ArxivSource", () => {
  describe("sourceId extraction", () => {
    it("extracts arxiv id from /abs/ URL", async () => {
      const source = makeMockedSource();
      const items = await source.fetch({ type: "arxiv", category: "cs.AI" }, new Date(0));
      expect(items[0]?.sourceId).toBe("1706.03762");
      expect(items[1]?.sourceId).toBe("1810.04805");
    });

    it("extracts arxiv id for old paper", async () => {
      const source = makeMockedSource();
      const items = await source.fetch({ type: "arxiv", category: "cs.AI" }, new Date(0));
      const oldPaper = items.find((i) => i.sourceId === "0001.00001");
      expect(oldPaper).toBeDefined();
    });
  });

  describe("date filtering", () => {
    it("filters items before since date", async () => {
      const source = makeMockedSource();
      const since = new Date("2024-01-20T00:00:00Z");
      const items = await source.fetch({ type: "arxiv", category: "cs.AI" }, since);
      for (const item of items) {
        expect(item.publishedAt.getTime()).toBeGreaterThanOrEqual(since.getTime());
      }
      expect(items.map((i) => i.sourceId)).toContain("1810.04805");
      expect(items.map((i) => i.sourceId)).not.toContain("1706.03762");
    });
  });

  describe("contract", () => {
    it("returns array", async () => {
      const source = makeMockedSource();
      const result = await source.fetch({ type: "arxiv", category: "cs.AI" }, new Date());
      expect(Array.isArray(result)).toBe(true);
    });

    it("each sourceId is unique", async () => {
      const source = makeMockedSource();
      const items = await source.fetch({ type: "arxiv", category: "cs.AI" }, new Date(0));
      const ids = items.map((i) => i.sourceId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("far-future since returns empty", async () => {
      const source = makeMockedSource();
      const since = new Date("2099-01-01T00:00:00Z");
      const items = await source.fetch({ type: "arxiv", category: "cs.AI" }, since);
      expect(items).toHaveLength(0);
    });

    it("content is non-empty string for each item", async () => {
      const source = makeMockedSource();
      const items = await source.fetch({ type: "arxiv", category: "cs.AI" }, new Date(0));
      for (const item of items) {
        expect(typeof item.content).toBe("string");
        expect(item.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe("error handling", () => {
    it("throws WikiFetchError when parser fails", async () => {
      const source = new ArxivSource();
      (source as unknown as { parser: { parseURL: ReturnType<typeof vi.fn> } }).parser = {
        parseURL: vi.fn().mockRejectedValue(new Error("Network error")),
      };
      const { WikiFetchError } = await import("@teamagent/ports");
      await expect(
        source.fetch({ type: "arxiv", category: "cs.AI" }, new Date(0)),
      ).rejects.toBeInstanceOf(WikiFetchError);
    });
  });
});
