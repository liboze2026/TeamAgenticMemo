import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

// node:sqlite 是 Node 22+ 实验性内置模块，不在 builtinModules 列表里，
// vite/vitest 的静态 import 无法解析。用 createRequire 在运行时加载。
const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncCtor } = require("node:sqlite") as typeof import("node:sqlite");

/** 所有 DDL 集中在这里，首次打开 DB 时幂等执行一次。 */
export const INIT_SQL = `
-- 知识主表
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  scope_level TEXT NOT NULL CHECK(scope_level IN ('personal','team','global')),
  scope_project TEXT,
  scope_paths TEXT,
  scope_file_types TEXT,
  scope_branches TEXT,
  category TEXT NOT NULL,
  tags TEXT,
  type TEXT NOT NULL,
  nature TEXT NOT NULL,
  trigger TEXT NOT NULL,
  wrong_pattern TEXT DEFAULT '',
  correct_pattern TEXT NOT NULL,
  correct_pattern_code_example TEXT,
  correct_pattern_import_path TEXT,
  correct_pattern_tldr TEXT,
  reasoning TEXT,
  when_expression TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  demerit REAL NOT NULL DEFAULT 0,
  demerit_last_updated TEXT,
  current_tier TEXT NOT NULL DEFAULT 'experimental'
    CHECK(current_tier IN ('experimental','probation','stable','canonical','enforced','dormant')),
  max_tier_ever TEXT NOT NULL DEFAULT 'experimental',
  tier_entered_at TEXT NOT NULL,
  enforcement TEXT NOT NULL DEFAULT 'passive',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','conflict','stale','archived','dormant')),
  hit_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  override_count INTEGER NOT NULL DEFAULT 0,
  resurrect_count INTEGER NOT NULL DEFAULT 0,
  evidence TEXT,
  source TEXT NOT NULL,
  conflict_with TEXT,
  created_at TEXT NOT NULL,
  last_hit_at TEXT,
  last_validated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_tier ON knowledge(current_tier);
CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge(scope_level, scope_project);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge(status);

-- 观察表（Calibrator 用，v2 新增）
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),
  source_event TEXT,
  tool_use_id TEXT,
  FOREIGN KEY(knowledge_id) REFERENCES knowledge(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_obs_knowledge ON observations(knowledge_id, timestamp DESC);

-- 事件表（替代 JsonlEventLog，全历史 append-only）
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  knowledge_id TEXT,
  tool_use_id TEXT,
  timestamp TEXT NOT NULL,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_knowledge ON events(knowledge_id);

-- Wiki 专用元数据表（SP-3 用，M2.1 先建表，实际填充在 M2.6）
CREATE TABLE IF NOT EXISTS wiki_meta (
  knowledge_id TEXT PRIMARY KEY,
  source_url TEXT,
  source_type TEXT,
  published_at TEXT,
  tldr TEXT,
  keywords TEXT,
  user_thumbs_down INTEGER DEFAULT 0,
  inline_injection_count INTEGER DEFAULT 0,
  FOREIGN KEY(knowledge_id) REFERENCES knowledge(id) ON DELETE CASCADE
);

-- 候选规则队列（M2.5-half，review-candidates 用）
CREATE TABLE IF NOT EXISTS rule_candidates (
  id          TEXT PRIMARY KEY,
  entry_json  TEXT NOT NULL,
  source_signals TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected','skipped')),
  created_at  TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON rule_candidates(status, created_at ASC);

-- schema 版本表（后续 migration 用）
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_version(version, applied_at) VALUES (1, datetime('now'));
`;

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * 打开/创建 SQLite DB 并确保 schema 初始化。
 * 幂等——重复调用无副作用。
 */
export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSyncCtor(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(INIT_SQL);
  return db;
}

/** 关闭连接（测试 cleanup 用）。 */
export function closeDb(db: DatabaseSync): void {
  db.close();
}
