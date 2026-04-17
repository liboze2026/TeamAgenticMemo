import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

// node:sqlite 是 Node 22+ 实验性内置模块，不在 builtinModules 列表里，
// vite/vitest 的静态 import 无法解析。用 createRequire 在运行时加载。
const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncCtor } = require("node:sqlite") as typeof import("node:sqlite");

// sqlite-vec: load synchronously via require (same pattern as node:sqlite above)
let _sqliteVecLoad: ((db: unknown) => void) | undefined;
try {
  const mod = require("sqlite-vec") as { load?: (db: unknown) => void };
  _sqliteVecLoad = mod.load;
} catch {
  // sqlite-vec native bindings not available — vector features will be disabled
}

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

-- Wiki 专用元数据表（SP-3 用，M2.6 完整版）
CREATE TABLE IF NOT EXISTS wiki_meta (
  knowledge_id             TEXT PRIMARY KEY,
  source_url               TEXT NOT NULL,
  source_type              TEXT NOT NULL,
  source_id                TEXT NOT NULL,
  published_at             TEXT NOT NULL,
  tldr                     TEXT NOT NULL,
  keywords                 TEXT NOT NULL,
  user_thumbs_down         INTEGER DEFAULT 0,
  inline_injection_count   INTEGER DEFAULT 0,
  last_injected_at         TEXT,
  fetch_error              TEXT,
  FOREIGN KEY(knowledge_id) REFERENCES knowledge(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wiki_source ON wiki_meta(source_type, source_id);

-- Wiki 订阅表（M2.6）
CREATE TABLE IF NOT EXISTS wiki_subscriptions (
  id          TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  config      TEXT NOT NULL,
  auto_added  INTEGER DEFAULT 0,
  enabled     INTEGER DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- Wiki 拒绝日志（M2.6）
CREATE TABLE IF NOT EXISTS wiki_rejection_log (
  id          TEXT PRIMARY KEY,
  source_type TEXT,
  source_id   TEXT,
  title       TEXT,
  reason      TEXT,
  rejected_at TEXT NOT NULL
);

-- Vector embeddings for wiki entries (sqlite-vec, M2.6)
-- CREATE VIRTUAL TABLE is intentionally omitted here; it's created in openDb()
-- after sqlite-vec extension is loaded, so it's guarded properly.

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

export const CURRENT_SCHEMA_VERSION = 4;


/**
 * 打开/创建 SQLite DB 并确保 schema 初始化。
 * 幂等——重复调用无副作用。
 */
export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSyncCtor(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Load sqlite-vec extension before DDL so vec0 virtual table can be created
  if (_sqliteVecLoad) {
    try { _sqliteVecLoad(db); } catch { /* ok if db doesn't support loadExtension */ }
  }

  db.exec(INIT_SQL);

  // Migration: schema_version 1 → 2 (add wiki_meta columns, wiki_subscriptions, wiki_rejection_log)
  const version = db.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get() as { version: number } | undefined;
  if (!version || version.version < 2) {
    // Add missing wiki_meta columns (ALTER TABLE IF NOT EXISTS not supported in SQLite)
    try { db.exec("ALTER TABLE wiki_meta ADD COLUMN source_id TEXT NOT NULL DEFAULT ''"); } catch {}
    try { db.exec("ALTER TABLE wiki_meta ADD COLUMN fetch_error TEXT"); } catch {}
    try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_wiki_source ON wiki_meta(source_type, source_id)"); } catch {}
    db.exec("INSERT OR REPLACE INTO schema_version(version, applied_at) VALUES (2, datetime('now'))");
  }

  // Migration: schema_version 2 → 3 (add knowledge_vec virtual table)
  if (!version || version.version < 3) {
    try {
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
        knowledge_id TEXT PRIMARY KEY,
        embedding FLOAT[384]
      )`);
    } catch { /* ok if sqlite-vec not loaded */ }
    db.exec("INSERT OR REPLACE INTO schema_version(version, applied_at) VALUES (3, datetime('now'))");
  }

  // Migration: schema_version 3 → 4 (add last_injected_at to wiki_meta)
  const versionNow = db.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get() as { version: number } | undefined;
  if (!versionNow || versionNow.version < 4) {
    try { db.exec("ALTER TABLE wiki_meta ADD COLUMN last_injected_at TEXT"); } catch {}
    db.exec("INSERT OR REPLACE INTO schema_version(version, applied_at) VALUES (4, datetime('now'))");
  }

  return db;
}

/** 关闭连接（测试 cleanup 用）。 */
export function closeDb(db: DatabaseSync): void {
  db.close();
}
