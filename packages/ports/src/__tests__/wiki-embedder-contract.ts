import { describe, it, expect } from "vitest";
import type { WikiEmbedderPort } from "../wiki-embedder.js";

/**
 * 契约测试套件——任何 WikiEmbedderPort 实现都应通过。
 *
 * 使用方式：
 *   describe("XenovaEmbedder", () => {
 *     wikiEmbedderContractSuite(() => new XenovaEmbedder());
 *   });
 */
export function wikiEmbedderContractSuite(factory: () => WikiEmbedderPort): void {
  describe("WikiEmbedderPort contract", () => {
    it("embed([]) returns []", async () => {
      const embedder = factory();
      const result = await embedder.embed([]);
      expect(result).toEqual([]);
    });

    it("embed(['text']) returns array of length 1", async () => {
      const embedder = factory();
      const result = await embedder.embed(["hello world"]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it("each embedding has length 384", async () => {
      const embedder = factory();
      const result = await embedder.embed(["foo", "bar"]);
      for (const embedding of result) {
        expect(embedding).toHaveLength(384);
      }
    });

    it("each value in embedding is a finite number", async () => {
      const embedder = factory();
      const result = await embedder.embed(["test sentence"]);
      for (const embedding of result) {
        for (const val of embedding) {
          expect(typeof val).toBe("number");
          expect(Number.isFinite(val)).toBe(true);
        }
      }
    });
  });
}
