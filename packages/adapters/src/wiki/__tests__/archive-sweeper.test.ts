import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../storage/sqlite/schema.js";
import { ArchiveSweeper } from "../archive-sweeper.js";
import type { DatabaseSync } from "node:sqlite";

function seedEntry(db: DatabaseSync, opts: {
  id: string;
  sourceType: string;
  sourceId: string;
  publishedAt: string;
  createdAt: string;
  injectionCount: number;
}): void {
  const { id, sourceType, sourceId, publishedAt, createdAt, injectionCount } = opts;
  db.prepare(`
    INSERT INTO knowledge (
      id, scope_level, category, tags, type, nature, trigger,
      wrong_pattern, correct_pattern, confidence, demerit,
      current_tier, max_tier_ever, tier_entered_at, enforcement,
      status, hit_count, success_count, override_count, resurrect_count,
      source, created_at
    ) VALUES (?, 'global', 'W', '[]', 'wiki', 'wiki', 'title', '', 'body', 0.7, 0,
      'experimental', 'experimental', ?, 'passive', 'active', 0, 0, 0, 0,
      'wiki_pipeline', ?)
  `).run(id, createdAt, createdAt);
  db.prepare(`
    INSERT INTO wiki_meta (
      knowledge_id, source_url, source_type, source_id, published_at,
      tldr, keywords, inline_injection_count
    ) VALUES (?, ?, ?, ?, ?, 'tldr', '[]', ?)
  `).run(id, `https://example.com/${id}`, sourceType, sourceId, publishedAt, injectionCount);
}

describe("ArchiveSweeper.sweep", () => {
  let db: DatabaseSync;
  let sweeper: ArchiveSweeper;

  beforeEach(() => {
    db = openDb(":memory:");
    sweeper = new ArchiveSweeper(db);
  });

  it("归档零命中+老龄条目，仅改 status 字段", () => {
    seedEntry(db, {
      id: "old-zero", sourceType: "github_release", sourceId: "a/b",
      publishedAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z",
      injectionCount: 0,
    });
    seedEntry(db, {
      id: "fresh", sourceType: "github_release", sourceId: "c/d",
      publishedAt: "2026-04-15T00:00:00Z", createdAt: "2026-04-15T00:00:00Z",
      injectionCount: 0,
    });

    const report = sweeper.sweep(new Date("2026-04-21T00:00:00Z"), {
      zeroHitMinAgeDays: 60, perSourceKeep: 3,
    });

    expect(report.archived).toHaveLength(1);
    expect(report.archived[0]!.knowledgeId).toBe("old-zero");

    const row = db.prepare("SELECT status FROM knowledge WHERE id = ?").get("old-zero") as { status: string };
    expect(row.status).toBe("archived");
    const freshRow = db.prepare("SELECT status FROM knowledge WHERE id = ?").get("fresh") as { status: string };
    expect(freshRow.status).toBe("active");
  });

  it("幂等：连续跑两次不再影响", () => {
    seedEntry(db, {
      id: "old-zero", sourceType: "github_release", sourceId: "a/b",
      publishedAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z",
      injectionCount: 0,
    });
    const now = new Date("2026-04-21T00:00:00Z");
    const r1 = sweeper.sweep(now);
    const r2 = sweeper.sweep(now);
    expect(r1.archived).toHaveLength(1);
    expect(r2.archived).toHaveLength(0);
  });

  it("只归档 source='wiki_pipeline' 的 knowledge，经验规则不碰", () => {
    db.prepare(`
      INSERT INTO knowledge (
        id, scope_level, category, tags, type, nature, trigger,
        wrong_pattern, correct_pattern, confidence, demerit,
        current_tier, max_tier_ever, tier_entered_at, enforcement,
        status, hit_count, success_count, override_count, resurrect_count,
        source, created_at
      ) VALUES ('rule-1', 'global', 'R', '[]', 'rule', 'rule', 'x', '', 'y', 0.9, 0,
        'stable', 'stable', '2026-01-01T00:00:00Z', 'passive', 'active', 0, 0, 0, 0,
        'manual', '2026-01-01T00:00:00Z')
    `).run();
    sweeper.sweep(new Date("2026-04-21T00:00:00Z"));
    const row = db.prepare("SELECT status FROM knowledge WHERE id = 'rule-1'").get() as { status: string };
    expect(row.status).toBe("active");
  });

  it("默认参数: zeroHitMinAgeDays=60, perSourceKeep=3", () => {
    seedEntry(db, {
      id: "old", sourceType: "github_release", sourceId: "a/b",
      publishedAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z",
      injectionCount: 0,
    });
    const report = sweeper.sweep(new Date("2026-04-21T00:00:00Z"));
    expect(report.archived).toHaveLength(1);
  });
});
