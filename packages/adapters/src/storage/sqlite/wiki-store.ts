import type { DatabaseSync } from "node:sqlite";
import type { WikiEntry } from "@teamagent/core";

export interface WikiStoreEntry {
  knowledgeId: string;
  sourceUrl: string;
  sourceType: string;
  sourceId: string;
  publishedAt: Date;
  tldr: string;
  keywords: string[];
  title: string;
}

export class WikiStore {
  constructor(private db: DatabaseSync) {}

  /**
   * Save a wiki entry. Idempotent: if (source_type, source_id) already exists, skip.
   * Returns: 'saved' | 'skipped'
   */
  save(entry: WikiEntry): "saved" | "skipped" {
    // Check if already exists
    const existing = this.db
      .prepare("SELECT knowledge_id FROM wiki_meta WHERE source_type = ? AND source_id = ?")
      .get(entry.sourceType, entry.sourceId) as { knowledge_id: string } | undefined;

    if (existing) {
      return "skipped";
    }

    const now = new Date().toISOString();
    const knowledgeId = entry.id;

    try {
      this.db.exec("BEGIN");

      // Insert into knowledge table
      this.db.prepare(`
        INSERT INTO knowledge (
          id, scope_level, scope_project, scope_paths, scope_file_types, scope_branches,
          category, tags, type, nature, trigger, wrong_pattern, correct_pattern,
          correct_pattern_code_example, correct_pattern_import_path, correct_pattern_tldr,
          reasoning, when_expression, confidence, demerit, demerit_last_updated,
          current_tier, max_tier_ever, tier_entered_at, enforcement, status,
          hit_count, success_count, override_count, resurrect_count,
          evidence, source, conflict_with, created_at, last_hit_at, last_validated_at
        ) VALUES (
          ?, 'global', NULL, NULL, NULL, NULL,
          'W', ?, 'wiki', 'wiki', ?, '', ?,
          NULL, NULL, ?,
          NULL, NULL, 0.7, 0, NULL,
          'experimental', 'experimental', ?, 'passive', 'active',
          0, 0, 0, 0,
          ?, 'wiki_pipeline', ?, ?, NULL, NULL
        )
      `).run(
        knowledgeId,
        JSON.stringify(entry.keywords),
        entry.title,           // trigger = title
        entry.tldr,            // correct_pattern = tldr
        entry.tldr,            // correct_pattern_tldr = tldr
        now,                   // tier_entered_at
        JSON.stringify({ success_sessions: 0, success_users: 0, correction_sessions: 0 }),  // evidence
        JSON.stringify([]),    // conflict_with
        now,                   // created_at
      );

      // Insert into wiki_meta
      this.db.prepare(`
        INSERT INTO wiki_meta (
          knowledge_id, source_url, source_type, source_id,
          published_at, tldr, keywords,
          user_thumbs_down, inline_injection_count, fetch_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NULL)
      `).run(
        knowledgeId,
        entry.sourceUrl,
        entry.sourceType,
        entry.sourceId,
        entry.publishedAt.toISOString(),
        entry.tldr,
        JSON.stringify(entry.keywords),
      );

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    return "saved";
  }

  /**
   * Record a rejection (for wiki:rejected command)
   */
  recordRejection(rejection: {
    sourceType: string;
    sourceId?: string;
    title?: string;
    reason: string;
  }): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO wiki_rejection_log (id, source_type, source_id, title, reason, rejected_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rejection.sourceType,
      rejection.sourceId ?? null,
      rejection.title ?? null,
      rejection.reason,
      now,
    );
  }

  /**
   * Mark wiki entry as disliked (user_thumbs_down = 1)
   */
  dislike(knowledgeId: string): boolean {
    const result = this.db
      .prepare("UPDATE wiki_meta SET user_thumbs_down = 1 WHERE knowledge_id = ?")
      .run(knowledgeId);
    return (result as { changes: number }).changes > 0;
  }

  /**
   * List wiki entries (for wiki:list command)
   */
  list(opts: { limit?: number; sourceType?: string }): WikiStoreEntry[] {
    const limit = opts.limit ?? 50;
    let sql: string;
    let rows: unknown[];

    if (opts.sourceType) {
      sql = `
        SELECT k.id, k.trigger, k.correct_pattern_tldr,
               wm.source_url, wm.source_type, wm.source_id,
               wm.published_at, wm.tldr, wm.keywords
        FROM knowledge k
        JOIN wiki_meta wm ON k.id = wm.knowledge_id
        WHERE k.status = 'active' AND wm.source_type = ?
        ORDER BY wm.published_at DESC
        LIMIT ?
      `;
      rows = this.db.prepare(sql).all(opts.sourceType, limit) as unknown[];
    } else {
      sql = `
        SELECT k.id, k.trigger, k.correct_pattern_tldr,
               wm.source_url, wm.source_type, wm.source_id,
               wm.published_at, wm.tldr, wm.keywords
        FROM knowledge k
        JOIN wiki_meta wm ON k.id = wm.knowledge_id
        WHERE k.status = 'active'
        ORDER BY wm.published_at DESC
        LIMIT ?
      `;
      rows = this.db.prepare(sql).all(limit) as unknown[];
    }

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      knowledgeId: row["id"] as string,
      sourceUrl: row["source_url"] as string,
      sourceType: row["source_type"] as string,
      sourceId: row["source_id"] as string,
      publishedAt: new Date(row["published_at"] as string),
      tldr: (row["tldr"] as string) ?? (row["correct_pattern_tldr"] as string) ?? "",
      keywords: JSON.parse((row["keywords"] as string) ?? "[]") as string[],
      title: (row["trigger"] as string) ?? "",
    }));
  }

  /**
   * List rejected entries (for wiki:rejected command)
   */
  listRejections(opts: { limit?: number }): Array<{
    id: string;
    sourceType?: string;
    title?: string;
    reason: string;
    rejectedAt: string;
  }> {
    const limit = opts.limit ?? 50;
    const rows = this.db
      .prepare("SELECT * FROM wiki_rejection_log ORDER BY rejected_at DESC LIMIT ?")
      .all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: row["id"] as string,
      sourceType: (row["source_type"] as string | null) ?? undefined,
      title: (row["title"] as string | null) ?? undefined,
      reason: row["reason"] as string,
      rejectedAt: row["rejected_at"] as string,
    }));
  }

  /**
   * Stats (for wiki:stats command)
   */
  stats(): {
    total: number;
    bySource: Record<string, number>;
    lastPull: string | null;
  } {
    const totalRow = this.db
      .prepare("SELECT COUNT(*) as n FROM wiki_meta WHERE user_thumbs_down = 0")
      .get() as { n: number };

    const bySourceRows = this.db
      .prepare(
        "SELECT source_type, COUNT(*) as n FROM wiki_meta WHERE user_thumbs_down = 0 GROUP BY source_type"
      )
      .all() as Array<{ source_type: string; n: number }>;

    const lastPullRow = this.db
      .prepare("SELECT MAX(published_at) as last FROM wiki_meta")
      .get() as { last: string | null };

    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) {
      bySource[row.source_type] = row.n;
    }

    return {
      total: totalRow.n,
      bySource,
      lastPull: lastPullRow.last,
    };
  }

  /**
   * Check if exists by source (for dedup)
   */
  existsBySource(sourceType: string, sourceId: string): boolean {
    const row = this.db
      .prepare("SELECT 1 AS found FROM wiki_meta WHERE source_type = ? AND source_id = ?")
      .get(sourceType, sourceId) as { found: number } | undefined;
    return row !== undefined;
  }
}
