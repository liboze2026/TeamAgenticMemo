import type { DatabaseSync } from "node:sqlite";
import type { KnowledgeEntry, Scope } from "@teamagent/types";

/** Flattened row shape coming from SQLite. */
interface KnowledgeRow {
  id: string;
  scope_level: string;
  scope_project: string | null;
  scope_paths: string | null;
  scope_file_types: string | null;
  scope_branches: string | null;
  category: string;
  tags: string | null;
  type: string;
  nature: string;
  trigger: string;
  wrong_pattern: string;
  correct_pattern: string;
  correct_pattern_code_example: string | null;
  correct_pattern_import_path: string | null;
  correct_pattern_tldr: string | null;
  reasoning: string;
  when_expression: string | null;
  confidence: number;
  demerit: number;
  demerit_last_updated: string | null;
  current_tier: string;
  max_tier_ever: string;
  tier_entered_at: string;
  enforcement: string;
  status: string;
  hit_count: number;
  success_count: number;
  override_count: number;
  resurrect_count: number;
  evidence: string | null;
  source: string;
  conflict_with: string | null;
  created_at: string;
  last_hit_at: string | null;
  last_validated_at: string | null;
}

function serializeEntry(entry: KnowledgeEntry): Record<string, unknown> {
  const e = entry as any;
  return {
    id: entry.id,
    scope_level: entry.scope.level,
    scope_project: entry.scope.project ?? null,
    scope_paths: entry.scope.paths ? JSON.stringify(entry.scope.paths) : null,
    scope_file_types: entry.scope.file_types ? JSON.stringify(entry.scope.file_types) : null,
    scope_branches: entry.scope.branches ? JSON.stringify(entry.scope.branches) : null,
    category: entry.category,
    tags: JSON.stringify(entry.tags),
    type: entry.type,
    nature: entry.nature,
    trigger: entry.trigger,
    wrong_pattern: entry.wrong_pattern,
    correct_pattern: entry.correct_pattern,
    correct_pattern_code_example: e.correct_pattern_code_example ?? null,
    correct_pattern_import_path: e.correct_pattern_import_path ?? null,
    correct_pattern_tldr: e.correct_pattern_tldr ?? null,
    reasoning: entry.reasoning,
    when_expression: e.when_expression ?? null,
    confidence: entry.confidence,
    demerit: e.demerit ?? 0,
    demerit_last_updated: e.demerit_last_updated ?? null,
    current_tier: e.current_tier ?? "experimental",
    max_tier_ever: e.max_tier_ever ?? "experimental",
    tier_entered_at: (e.tier_entered_at && e.tier_entered_at.length > 0) ? e.tier_entered_at : entry.created_at,
    enforcement: entry.enforcement,
    status: entry.status,
    hit_count: entry.hit_count,
    success_count: entry.success_count,
    override_count: entry.override_count,
    resurrect_count: e.resurrect_count ?? 0,
    evidence: JSON.stringify(entry.evidence),
    source: entry.source,
    conflict_with: JSON.stringify(entry.conflict_with),
    created_at: entry.created_at,
    last_hit_at: entry.last_hit_at || null,
    last_validated_at: entry.last_validated_at || null,
  };
}

function deserializeRow(row: KnowledgeRow): KnowledgeEntry {
  const scope: Scope = {
    level: row.scope_level as Scope["level"],
    ...(row.scope_project != null ? { project: row.scope_project } : {}),
    ...(row.scope_paths != null ? { paths: JSON.parse(row.scope_paths) } : {}),
    ...(row.scope_file_types != null ? { file_types: JSON.parse(row.scope_file_types) } : {}),
    ...(row.scope_branches != null ? { branches: JSON.parse(row.scope_branches) } : {}),
  };

  return {
    id: row.id,
    scope,
    category: row.category as KnowledgeEntry["category"],
    tags: row.tags ? JSON.parse(row.tags) : [],
    type: row.type as KnowledgeEntry["type"],
    nature: row.nature as KnowledgeEntry["nature"],
    trigger: row.trigger,
    wrong_pattern: row.wrong_pattern ?? "",
    correct_pattern: row.correct_pattern,
    reasoning: row.reasoning ?? "",
    confidence: row.confidence,
    current_tier: (row.current_tier ?? "experimental") as KnowledgeEntry["current_tier"],
    max_tier_ever: (row.max_tier_ever ?? "experimental") as KnowledgeEntry["max_tier_ever"],
    tier_entered_at: (row.tier_entered_at as string) ?? "",
    demerit: (row.demerit as number) ?? 0,
    demerit_last_updated: (row.demerit_last_updated as string) ?? "",
    resurrect_count: (row.resurrect_count as number) ?? 0,
    enforcement: row.enforcement as KnowledgeEntry["enforcement"],
    status: row.status as KnowledgeEntry["status"],
    hit_count: row.hit_count,
    success_count: row.success_count,
    override_count: row.override_count,
    evidence: row.evidence
      ? JSON.parse(row.evidence)
      : { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: row.created_at,
    last_hit_at: row.last_hit_at ?? "",
    last_validated_at: row.last_validated_at ?? "",
    source: row.source as KnowledgeEntry["source"],
    conflict_with: row.conflict_with ? JSON.parse(row.conflict_with) : [],
  };
}

const INSERT_SQL = `
INSERT INTO knowledge (
  id, scope_level, scope_project, scope_paths, scope_file_types, scope_branches,
  category, tags, type, nature, trigger, wrong_pattern, correct_pattern,
  correct_pattern_code_example, correct_pattern_import_path, correct_pattern_tldr,
  reasoning, when_expression, confidence, demerit, demerit_last_updated,
  current_tier, max_tier_ever, tier_entered_at, enforcement, status,
  hit_count, success_count, override_count, resurrect_count,
  evidence, source, conflict_with, created_at, last_hit_at, last_validated_at
) VALUES (
  @id, @scope_level, @scope_project, @scope_paths, @scope_file_types, @scope_branches,
  @category, @tags, @type, @nature, @trigger, @wrong_pattern, @correct_pattern,
  @correct_pattern_code_example, @correct_pattern_import_path, @correct_pattern_tldr,
  @reasoning, @when_expression, @confidence, @demerit, @demerit_last_updated,
  @current_tier, @max_tier_ever, @tier_entered_at, @enforcement, @status,
  @hit_count, @success_count, @override_count, @resurrect_count,
  @evidence, @source, @conflict_with, @created_at, @last_hit_at, @last_validated_at
)`;

const SELECT_BY_ID = "SELECT * FROM knowledge WHERE id = @id";
const SELECT_ALL = "SELECT * FROM knowledge";
const SELECT_BY_SCOPE = "SELECT * FROM knowledge WHERE scope_level = @level";
const SELECT_ACTIVE = "SELECT * FROM knowledge WHERE status = 'active'";
const DELETE_BY_ID = "DELETE FROM knowledge WHERE id = @id";

export class SqliteKnowledgeStore {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  add(entry: KnowledgeEntry): void {
    const params = serializeEntry(entry);
    this.db.prepare(INSERT_SQL).run(params as Record<string, any>);
  }

  getById(id: string): KnowledgeEntry | undefined {
    const row = this.db.prepare(SELECT_BY_ID).get({ id }) as KnowledgeRow | undefined;
    return row ? deserializeRow(row) : undefined;
  }

  getAll(): KnowledgeEntry[] {
    const rows = this.db.prepare(SELECT_ALL).all() as unknown as KnowledgeRow[];
    return rows.map(deserializeRow);
  }

  findByScopeLevel(level: "personal" | "team" | "global"): KnowledgeEntry[] {
    const rows = this.db.prepare(SELECT_BY_SCOPE).all({ level }) as unknown as KnowledgeRow[];
    return rows.map(deserializeRow);
  }

  findActive(): KnowledgeEntry[] {
    const rows = this.db.prepare(SELECT_ACTIVE).all() as unknown as KnowledgeRow[];
    return rows.map(deserializeRow);
  }

  /** KnowledgeStore port compatibility */
  getActive(): KnowledgeEntry[] {
    return this.findActive();
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as n FROM knowledge").get() as { n: number };
    return row.n;
  }

  query(options: {
    keyword?: string;
    category?: string;
    minConfidence?: number;
    includeArchived?: boolean;
    limit?: number;
  } = {}): KnowledgeEntry[] {
    let entries = options.includeArchived ? this.getAll() : this.findActive();
    if (options.keyword) {
      const kw = options.keyword.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.trigger.toLowerCase().includes(kw) ||
          e.correct_pattern.toLowerCase().includes(kw) ||
          (e.wrong_pattern ?? "").toLowerCase().includes(kw) ||
          e.tags.some((t) => t.toLowerCase().includes(kw)),
      );
    }
    if (options.category) {
      entries = entries.filter((e) => e.category === options.category);
    }
    if (options.minConfidence !== undefined) {
      entries = entries.filter((e) => e.confidence >= options.minConfidence!);
    }
    if (options.limit !== undefined) {
      entries = entries.slice(0, options.limit);
    }
    return entries;
  }

  update(id: string, patch: Partial<KnowledgeEntry> & Record<string, unknown>): void {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Knowledge entry not found: ${id}`);
    }

    // Merge patch into existing, then re-serialize and overwrite
    const merged = { ...existing, ...patch } as KnowledgeEntry;
    // Handle scope merge specially — if patch has scope, merge it
    if (patch.scope) {
      merged.scope = { ...existing.scope, ...patch.scope };
    }

    const params = serializeEntry(merged);

    // Build UPDATE SET clause for all columns
    const setClauses = [
      "scope_level = @scope_level", "scope_project = @scope_project",
      "scope_paths = @scope_paths", "scope_file_types = @scope_file_types",
      "scope_branches = @scope_branches", "category = @category", "tags = @tags",
      "type = @type", "nature = @nature", "trigger = @trigger",
      "wrong_pattern = @wrong_pattern", "correct_pattern = @correct_pattern",
      "correct_pattern_code_example = @correct_pattern_code_example",
      "correct_pattern_import_path = @correct_pattern_import_path",
      "correct_pattern_tldr = @correct_pattern_tldr",
      "reasoning = @reasoning", "when_expression = @when_expression",
      "confidence = @confidence", "demerit = @demerit",
      "demerit_last_updated = @demerit_last_updated",
      "current_tier = @current_tier", "max_tier_ever = @max_tier_ever",
      "tier_entered_at = @tier_entered_at", "enforcement = @enforcement",
      "status = @status", "hit_count = @hit_count", "success_count = @success_count",
      "override_count = @override_count", "resurrect_count = @resurrect_count",
      "evidence = @evidence", "source = @source", "conflict_with = @conflict_with",
      "created_at = @created_at", "last_hit_at = @last_hit_at",
      "last_validated_at = @last_validated_at",
    ];

    const sql = `UPDATE knowledge SET ${setClauses.join(", ")} WHERE id = @id`;
    this.db.prepare(sql).run(params as Record<string, any>);
  }

  delete(id: string): void {
    this.db.prepare(DELETE_BY_ID).run({ id });
  }

  close(): void {
    this.db.close();
  }
}
