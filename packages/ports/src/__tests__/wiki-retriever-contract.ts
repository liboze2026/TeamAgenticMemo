import { describe, it, expect } from "vitest";
import type { WikiRetrieverPort, WikiQueryOptions } from "../wiki-retriever.js";

const FAKE_EMBEDDING = new Array(384).fill(0.1) as number[];

const BASE_OPTS: WikiQueryOptions = {
  embedding: FAKE_EMBEDDING,
  minSimilarity: 0.0,
  maxAgeDays: 365,
  maxResults: 5,
  now: new Date("2026-06-01T12:00:00Z"),
  cooldownMinutes: 30,
  sessionWindowMinutes: 60,
  sessionMaxInjections: 15,
};

export function wikiRetrieverContractSuite(
  factory: () => WikiRetrieverPort,
): void {
  describe("WikiRetrieverPort contract", () => {
    it("query() returns an array", async () => {
      const r = factory();
      const result = await r.query(BASE_OPTS);
      expect(Array.isArray(result)).toBe(true);
    });

    it("result length <= maxResults", async () => {
      const r = factory();
      const result = await r.query({ ...BASE_OPTS, maxResults: 2 });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("results sorted by similarity descending", async () => {
      const r = factory();
      const result = await r.query(BASE_OPTS);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]!.similarity).toBeGreaterThanOrEqual(result[i]!.similarity);
      }
    });

    it("sessionMaxInjections=0 returns empty array immediately", async () => {
      const r = factory();
      const result = await r.query({ ...BASE_OPTS, sessionMaxInjections: 0 });
      expect(result).toEqual([]);
    });

    it("maxAgeDays=0 returns empty array", async () => {
      const r = factory();
      const result = await r.query({ ...BASE_OPTS, maxAgeDays: 0 });
      expect(result.length).toBe(0);
    });

    it("recordInjection + cooldown: same entry not returned within cooldown window", async () => {
      const r = factory();
      const first = await r.query({ ...BASE_OPTS, minSimilarity: 0.0 });
      if (first.length === 0) return;
      r.recordInjection(first.map(e => e.knowledgeId), BASE_OPTS.now);
      const second = await r.query({ ...BASE_OPTS, now: BASE_OPTS.now });
      const firstIds = new Set(first.map(e => e.knowledgeId));
      for (const entry of second) {
        expect(firstIds.has(entry.knowledgeId)).toBe(false);
      }
    });

    it("query() never throws", async () => {
      const r = factory();
      await expect(r.query(BASE_OPTS)).resolves.not.toThrow();
    });
  });
}
