import { describe, it, expect } from "vitest";
import { computeArchivals, type WikiEntrySnapshot } from "../sweeper.js";

const now = new Date("2026-04-21T00:00:00Z");

function mk(overrides: Partial<WikiEntrySnapshot>): WikiEntrySnapshot {
  return {
    knowledgeId: "k1",
    sourceType: "github_release",
    sourceId: "vitest-dev/vitest",
    publishedAt: new Date("2026-04-01T00:00:00Z"),
    fetchedAt: new Date("2026-04-01T00:00:00Z"),
    inlineInjectionCount: 0,
    ...overrides,
  };
}

describe("computeArchivals", () => {
  it("归档：零命中 + age > 阈值", () => {
    const stale = mk({
      knowledgeId: "s1",
      fetchedAt: new Date("2026-01-01T00:00:00Z"), // 110d ago
      inlineInjectionCount: 0,
    });
    const result = computeArchivals([stale], {
      zeroHitMinAgeDays: 60,
      perSourceKeep: 3,
      now,
    });
    expect(result).toEqual([{ knowledgeId: "s1", reason: "zero-hit-aged" }]);
  });

  it("保留：零命中但 age 未超阈值", () => {
    const fresh = mk({
      fetchedAt: new Date("2026-04-01T00:00:00Z"), // 20d ago
      inlineInjectionCount: 0,
    });
    expect(computeArchivals([fresh], {
      zeroHitMinAgeDays: 60,
      perSourceKeep: 3,
      now,
    })).toEqual([]);
  });

  it("保留：有命中即使老龄", () => {
    const useful = mk({
      fetchedAt: new Date("2026-01-01T00:00:00Z"),
      inlineInjectionCount: 2,
    });
    expect(computeArchivals([useful], {
      zeroHitMinAgeDays: 60,
      perSourceKeep: 3,
      now,
    })).toEqual([]);
  });

  it("同 source_id 超过 keep 数：归档老的", () => {
    const entries = [
      mk({ knowledgeId: "v5", publishedAt: new Date("2026-04-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v4", publishedAt: new Date("2026-03-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v3", publishedAt: new Date("2026-02-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v2", publishedAt: new Date("2026-01-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v1", publishedAt: new Date("2025-12-10"), inlineInjectionCount: 1 }),
    ];
    const result = computeArchivals(entries, {
      zeroHitMinAgeDays: 60,
      perSourceKeep: 3,
      now,
    });
    expect(result.map(r => r.knowledgeId).sort()).toEqual(["v1", "v2"]);
    expect(result.every(r => r.reason === "source-overflow")).toBe(true);
  });

  it("不同 source_id 独立计数", () => {
    const entries = [
      mk({ knowledgeId: "a", sourceId: "repo-a", publishedAt: new Date("2026-04-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "b", sourceId: "repo-b", publishedAt: new Date("2026-04-10"), inlineInjectionCount: 1 }),
    ];
    expect(computeArchivals(entries, {
      zeroHitMinAgeDays: 60,
      perSourceKeep: 1,
      now,
    })).toEqual([]);
  });

  it("同 source_id 恰好 keep 数：不归档", () => {
    const entries = [
      mk({ knowledgeId: "v3", publishedAt: new Date("2026-04-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v2", publishedAt: new Date("2026-03-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v1", publishedAt: new Date("2026-02-10"), inlineInjectionCount: 1 }),
    ];
    expect(computeArchivals(entries, {
      zeroHitMinAgeDays: 60,
      perSourceKeep: 3,
      now,
    })).toEqual([]);
  });

  it("两个规则重叠：只返回一次，优先 zero-hit-aged", () => {
    const entries = [
      mk({ knowledgeId: "old", sourceId: "r", publishedAt: new Date("2026-01-01"), fetchedAt: new Date("2026-01-01"), inlineInjectionCount: 0 }),
      mk({ knowledgeId: "v3", sourceId: "r", publishedAt: new Date("2026-04-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v2", sourceId: "r", publishedAt: new Date("2026-03-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "v1", sourceId: "r", publishedAt: new Date("2026-02-10"), inlineInjectionCount: 1 }),
    ];
    const result = computeArchivals(entries, { zeroHitMinAgeDays: 60, perSourceKeep: 3, now });
    const ids = result.map(r => r.knowledgeId);
    expect(ids).toContain("old");
    expect(new Set(ids).size).toBe(ids.length);
    const oldEntry = result.find(r => r.knowledgeId === "old");
    expect(oldEntry?.reason).toBe("zero-hit-aged");
  });

  it("同 sourceId 跨 sourceType 共享 bucket（dedup by sourceId only per spec §4）", () => {
    const entries = [
      mk({ knowledgeId: "gh", sourceType: "github_release", sourceId: "same-repo", publishedAt: new Date("2026-04-10"), inlineInjectionCount: 1 }),
      mk({ knowledgeId: "npm", sourceType: "npm",           sourceId: "same-repo", publishedAt: new Date("2026-03-10"), inlineInjectionCount: 1 }),
    ];
    const result = computeArchivals(entries, { zeroHitMinAgeDays: 60, perSourceKeep: 1, now });
    // Should archive exactly 1 (the older one), not 0
    expect(result).toHaveLength(1);
    expect(result[0]!.knowledgeId).toBe("npm"); // older publishedAt
    expect(result[0]!.reason).toBe("source-overflow");
  });
});
