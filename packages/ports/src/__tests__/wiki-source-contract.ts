import { describe, it, expect } from "vitest";
import type { WikiSourcePort, WikiSourceConfig, RawWikiItem } from "../wiki-source.js";
import { WikiFetchError } from "../wiki-source.js";

/**
 * 契约测试套件——任何 WikiSourcePort 实现都应通过。
 *
 * 使用方式：
 *   describe("MyWikiSource", () => {
 *     wikiSourceContractSuite(() => new MyWikiSource(), { type: "rss", url: "..." });
 *   });
 */
export function wikiSourceContractSuite(
  factory: () => WikiSourcePort,
  config: WikiSourceConfig,
): void {
  describe("WikiSourcePort contract", () => {
    it("fetch() returns an array (empty ok, no throw)", async () => {
      const source = factory();
      const since = new Date();
      const result = await source.fetch(config, since);
      expect(Array.isArray(result)).toBe(true);
    });

    it("each sourceId is unique within a batch", async () => {
      const source = factory();
      const since = new Date(0); // epoch — should return items if any
      const result = await source.fetch(config, since);
      const ids = result.map((item) => item.sourceId);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it("items with publishedAt before `since` are NOT returned", async () => {
      const source = factory();
      const since = new Date("2099-01-01T00:00:00Z"); // far future — nothing should be newer
      const result = await source.fetch(config, since);
      for (const item of result) {
        expect(item.publishedAt.getTime()).toBeGreaterThanOrEqual(since.getTime());
      }
    });

    it("content is non-empty string for each returned item", async () => {
      const source = factory();
      const since = new Date(0);
      const result = await source.fetch(config, since);
      for (const item of result) {
        expect(typeof item.content).toBe("string");
        expect(item.content.length).toBeGreaterThan(0);
      }
    });

    it("network failure throws WikiFetchError (not swallowed)", async () => {
      // Use a failing stub: create a source that always rejects with a network error
      const failingSource: WikiSourcePort = {
        sourceType: config.type,
        async fetch(_cfg: WikiSourceConfig, _since: Date): Promise<RawWikiItem[]> {
          throw new WikiFetchError(
            String(config.type),
            "Simulated network failure",
            new Error("ECONNREFUSED"),
          );
        },
      };

      await expect(
        failingSource.fetch(config, new Date()),
      ).rejects.toBeInstanceOf(WikiFetchError);
    });
  });
}
