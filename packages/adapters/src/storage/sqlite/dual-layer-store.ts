import { openDb } from "./schema.js";
import { SqliteKnowledgeStore } from "./sqlite-knowledge-store.js";
import type { KnowledgeEntry } from "@teamagent/types";

export interface DualLayerStoreConfig {
  projectDbPath: string;
  userGlobalDbPath: string;
}

/**
 * Q1 决策 C —— 混合双层：
 *   <project>/.teamagent/knowledge.db   ← scope.level=personal
 *   ~/.teamagent/global.db              ← scope.level=global
 *
 * 查询时两层合并。team 作用域留到 Phase 4（现在抛错）。
 */
export class DualLayerStore {
  private readonly project: SqliteKnowledgeStore;
  private readonly global: SqliteKnowledgeStore;

  constructor(cfg: DualLayerStoreConfig) {
    this.project = new SqliteKnowledgeStore(openDb(cfg.projectDbPath));
    this.global = new SqliteKnowledgeStore(openDb(cfg.userGlobalDbPath));
  }

  add(entry: KnowledgeEntry): void {
    switch (entry.scope.level) {
      case "personal":
        this.project.add(entry);
        return;
      case "global":
        this.global.add(entry);
        return;
      case "team":
        throw new Error("team-scoped entries are not supported until Phase 4");
      default:
        throw new Error(`unknown scope level: ${(entry.scope as any).level}`);
    }
  }

  getById(id: string): KnowledgeEntry | undefined {
    return this.project.getById(id) ?? this.global.getById(id);
  }

  findActive(): KnowledgeEntry[] {
    return [...this.project.findActive(), ...this.global.findActive()];
  }

  getAll(): KnowledgeEntry[] {
    return [...this.project.getAll(), ...this.global.getAll()];
  }

  getProjectStore(): SqliteKnowledgeStore {
    return this.project;
  }

  getGlobalStore(): SqliteKnowledgeStore {
    return this.global;
  }

  close(): void {
    this.project.close();
    this.global.close();
  }
}
