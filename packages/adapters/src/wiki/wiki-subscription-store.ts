import type { DatabaseSync } from "node:sqlite";

export interface WikiSubscription {
  id: string;
  sourceType: string;
  config: Record<string, unknown>;
  autoAdded: boolean;
  enabled: boolean;
  createdAt: string;
}

export class WikiSubscriptionStore {
  constructor(private db: DatabaseSync) {}

  /**
   * Check if any subscriptions exist
   */
  isEmpty(): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) as n FROM wiki_subscriptions")
      .get() as { n: number };
    return row.n === 0;
  }

  /**
   * Save subscriptions (from AutoSubscriber on first run). Idempotent.
   */
  saveAll(
    configs: Array<{
      sourceType: string;
      config: Record<string, unknown>;
      autoAdded: boolean;
    }>
  ): void {
    const existing = this.list();
    for (const cfg of configs) {
      const configJson = JSON.stringify(cfg.config);
      const duplicate = existing.some(
        (e) =>
          e.sourceType === cfg.sourceType &&
          JSON.stringify(e.config) === configJson
      );
      if (!duplicate) {
        this.add(cfg.sourceType, cfg.config, cfg.autoAdded);
      }
    }
  }

  /**
   * Add single subscription
   */
  add(
    sourceType: string,
    config: Record<string, unknown>,
    autoAdded = false
  ): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO wiki_subscriptions (id, source_type, config, auto_added, enabled, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(id, sourceType, JSON.stringify(config), autoAdded ? 1 : 0, now);
  }

  /**
   * Remove subscription by id
   */
  remove(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM wiki_subscriptions WHERE id = ?")
      .run(id) as { changes: number };
    return result.changes > 0;
  }

  /**
   * List all subscriptions
   */
  list(): WikiSubscription[] {
    const rows = this.db
      .prepare("SELECT * FROM wiki_subscriptions ORDER BY created_at ASC")
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: row["id"] as string,
      sourceType: row["source_type"] as string,
      config: JSON.parse(row["config"] as string) as Record<string, unknown>,
      autoAdded: (row["auto_added"] as number) === 1,
      enabled: (row["enabled"] as number) === 1,
      createdAt: row["created_at"] as string,
    }));
  }

  /**
   * Get enabled configs for fetching
   */
  getEnabledConfigs(): Array<{
    sourceType: string;
    config: Record<string, unknown>;
  }> {
    const rows = this.db
      .prepare(
        "SELECT source_type, config FROM wiki_subscriptions WHERE enabled = 1 ORDER BY created_at ASC"
      )
      .all() as Array<{ source_type: string; config: string }>;

    return rows.map((row) => ({
      sourceType: row.source_type,
      config: JSON.parse(row.config) as Record<string, unknown>,
    }));
  }
}
