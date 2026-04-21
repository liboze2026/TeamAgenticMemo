import type { DatabaseSync } from "node:sqlite";
import { computeArchivals, type WikiEntrySnapshot, type ArchiveDecision } from "@teamagent/core";

export interface SweeperOptions {
  zeroHitMinAgeDays?: number;
  perSourceKeep?: number;
}

export interface SweepReport {
  archived: ArchiveDecision[];
  byReason: { zeroHitAged: number; sourceOverflow: number };
}

const DEFAULT_ZERO_HIT_MIN_AGE_DAYS = 60;
const DEFAULT_PER_SOURCE_KEEP = 3;

export class ArchiveSweeper {
  constructor(private db: DatabaseSync) {}

  sweep(now: Date, opts: SweeperOptions = {}): SweepReport {
    const zeroHitMinAgeDays = opts.zeroHitMinAgeDays ?? DEFAULT_ZERO_HIT_MIN_AGE_DAYS;
    const perSourceKeep = opts.perSourceKeep ?? DEFAULT_PER_SOURCE_KEEP;

    const rows = this.db.prepare(`
      SELECT
        k.id             AS knowledge_id,
        wm.source_type   AS source_type,
        wm.source_id     AS source_id,
        wm.published_at  AS published_at,
        k.created_at     AS fetched_at,
        wm.inline_injection_count AS injection_count
      FROM knowledge k
      JOIN wiki_meta wm ON wm.knowledge_id = k.id
      WHERE k.status = 'active' AND k.source = 'wiki_pipeline'
    `).all() as Array<{
      knowledge_id: string;
      source_type: string;
      source_id: string;
      published_at: string;
      fetched_at: string;
      injection_count: number;
    }>;

    const snapshots: WikiEntrySnapshot[] = rows.map((r) => ({
      knowledgeId: r.knowledge_id,
      sourceType: r.source_type,
      sourceId: r.source_id,
      publishedAt: new Date(r.published_at),
      fetchedAt: new Date(r.fetched_at),
      inlineInjectionCount: r.injection_count,
    }));

    const decisions = computeArchivals(snapshots, {
      zeroHitMinAgeDays,
      perSourceKeep,
      now,
    });

    if (decisions.length > 0) {
      const stmt = this.db.prepare("UPDATE knowledge SET status = 'archived' WHERE id = ?");
      this.db.exec("BEGIN");
      try {
        for (const d of decisions) stmt.run(d.knowledgeId);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }

    const byReason = {
      zeroHitAged: decisions.filter((d) => d.reason === "zero-hit-aged").length,
      sourceOverflow: decisions.filter((d) => d.reason === "source-overflow").length,
    };

    return { archived: decisions, byReason };
  }
}
