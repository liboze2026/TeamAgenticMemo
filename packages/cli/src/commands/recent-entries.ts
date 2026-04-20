import path from "node:path";

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
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof import("better-sqlite3");
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare(
        `SELECT tldr, confidence FROM knowledge_entries
         WHERE status = 'active'
           AND created_at >= datetime('now', '-2 hours')
         ORDER BY created_at DESC
         LIMIT 10`,
      )
      .all() as RecentEntry[];
    db.close();
    return rows;
  } catch {
    return [];
  }
}
