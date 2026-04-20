import path from "node:path";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

// node:sqlite is a Node 22+ experimental built-in. Use createRequire to load it
// at runtime to avoid ESM static-import resolution issues in vitest.
const _require = createRequire(import.meta.url);

export interface RecentEntry {
  tldr: string;
  confidence: number;
}

/**
 * Queries project knowledge DB for active entries created in the last 2 hours.
 * Returns empty array on any error (DB missing, table missing, etc.).
 */
export async function getRecentEntries(cwd: string): Promise<RecentEntry[]> {
  const dbPath = path.join(cwd, ".teamagent", "knowledge.db");
  let db: DatabaseSync | undefined;
  try {
    const { DatabaseSync } = _require("node:sqlite") as typeof import("node:sqlite");
    db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db
        .prepare(
          `SELECT COALESCE(correct_pattern_tldr, trigger) AS tldr, confidence
           FROM knowledge
           WHERE status = 'active'
             AND created_at >= datetime('now', '-2 hours')
           ORDER BY created_at DESC
           LIMIT 10`,
        )
        .all() as RecentEntry[];
      return rows;
    } finally {
      db.close();
    }
  } catch {
    try { db?.close(); } catch { /* already closed */ }
    return [];
  }
}
