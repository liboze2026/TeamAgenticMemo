import type { DatabaseSync } from "node:sqlite";
import type { WikiRetrieverPort, WikiInjectionEntry, WikiQueryOptions } from "@teamagent/ports";

export class SqliteWikiRetriever implements WikiRetrieverPort {
  constructor(private db: DatabaseSync) {}

  async query(opts: WikiQueryOptions): Promise<WikiInjectionEntry[]> {
    const {
      embedding,
      minSimilarity,
      maxAgeDays,
      maxResults,
      now,
      cooldownMinutes,
      sessionWindowMinutes,
      sessionMaxInjections,
    } = opts;

    const cooldownStr = String(Math.floor(Number(cooldownMinutes)));
    const sessionWindowStr = String(Math.floor(Number(sessionWindowMinutes)));
    const maxAgeDaysStr = String(Math.floor(Number(maxAgeDays)));

    // Step 1: session total check — if already injected >= limit in window, bail out
    const sessionRow = this.db.prepare(`
      SELECT COUNT(*) AS n FROM wiki_meta
      WHERE last_injected_at > datetime(?, '-' || ? || ' minutes')
    `).get(now.toISOString(), sessionWindowStr) as { n: number };

    if (sessionRow.n >= sessionMaxInjections) return [];

    // Step 2: sqlite-vec cosine search + filters
    const embeddingJson = JSON.stringify(embedding);

    let rows: Array<Record<string, unknown>>;
    try {
      rows = this.db.prepare(`
        SELECT
          wm.knowledge_id,
          wm.tldr,
          wm.source_type,
          wm.published_at,
          (1 - vec_distance_cosine(kv.embedding, ?)) AS similarity
        FROM knowledge_vec kv
        JOIN wiki_meta wm ON kv.knowledge_id = wm.knowledge_id
        WHERE
          wm.user_thumbs_down = 0
          AND (wm.last_injected_at IS NULL
               OR wm.last_injected_at < datetime(?, '-' || ? || ' minutes'))
          AND wm.published_at > datetime(?, '-' || ? || ' days')
          AND (1 - vec_distance_cosine(kv.embedding, ?)) >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `).all(
        embeddingJson,
        now.toISOString(), cooldownStr,
        now.toISOString(), maxAgeDaysStr,
        embeddingJson, minSimilarity,
        maxResults,
      ) as Array<Record<string, unknown>>;
    } catch {
      // sqlite-vec not loaded (test env without native bindings)
      return [];
    }

    return rows.map((row) => ({
      knowledgeId: row["knowledge_id"] as string,
      tldr: row["tldr"] as string,
      sourceType: row["source_type"] as string,
      publishedAt: new Date(row["published_at"] as string),
      similarity: row["similarity"] as number,
    }));
  }

  recordInjection(knowledgeIds: string[], now: Date): void {
    const stmt = this.db.prepare(`
      UPDATE wiki_meta
      SET last_injected_at = ?,
          inline_injection_count = inline_injection_count + 1
      WHERE knowledge_id = ?
    `);
    for (const id of knowledgeIds) {
      stmt.run(now.toISOString(), id);
    }
  }
}
