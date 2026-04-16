import { z } from "zod";

/**
 * 知识条目的作用域。决定这条知识在什么时候生效。
 */
export const ScopeSchema = z.object({
  /** personal=只对我 / team=本项目成员 / global=所有项目 */
  level: z.enum(["personal", "team", "global"]),
  /** 可选：限定到某项目 */
  project: z.string().optional(),
  /** 可选：glob 路径限定 */
  paths: z.array(z.string()).optional(),
  /** 可选：文件类型限定 */
  file_types: z.array(z.string()).optional(),
  /** 可选：分支限定 */
  branches: z.array(z.string()).optional(),
});

export type Scope = z.infer<typeof ScopeSchema>;

/**
 * 支持证据：多少次验证过这条知识有效。
 */
export const EvidenceSchema = z.object({
  success_sessions: z.number().int().nonnegative().default(0),
  success_users: z.number().int().nonnegative().default(0),
  correction_sessions: z.number().int().nonnegative().default(0),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * 知识条目——知识库的最小单元。
 *
 * 字段设计对齐 spec v5.2 "知识条目" 章节。
 */
export const KnowledgeEntrySchema = z.object({
  id: z.string().min(1),
  scope: ScopeSchema,

  /** C=代码层 E=工程层 S=策略层 K=认知层 */
  category: z.enum(["C", "E", "S", "K"]),
  /** 自由标签，系统会自动聚类 */
  tags: z.array(z.string()),

  /** avoidance=避坑 practice=最佳实践 */
  type: z.enum(["avoidance", "practice"]),
  /** objective=客观可验证 subjective=主观偏好 */
  nature: z.enum(["objective", "subjective"]),

  trigger: z.string(),
  wrong_pattern: z.string().default(""),
  correct_pattern: z.string(),
  reasoning: z.string(),

  /** 0.0-1.0；来源见 spec v5.2 置信度校准 */
  confidence: z.number().min(0).max(1),
  /** block=≥0.9 warn=0.7-0.9 suggest=0.5-0.7 passive=<0.5 */
  enforcement: z.enum(["block", "warn", "suggest", "passive"]),

  /** active=生效 conflict=与他冲突 stale=待重验 archived=已归档 dormant=休眠 */
  status: z.enum(["active", "conflict", "stale", "archived", "dormant"]).default("active"),

  hit_count: z.number().int().nonnegative().default(0),
  success_count: z.number().int().nonnegative().default(0),
  override_count: z.number().int().nonnegative().default(0),

  evidence: EvidenceSchema.default({
    success_sessions: 0,
    success_users: 0,
    correction_sessions: 0,
  }),

  /** ISO 8601 */
  created_at: z.string(),
  last_hit_at: z.string().default(""),
  last_validated_at: z.string().default(""),

  /** 来源。preset=预置元原则 / imported=从已有规则导入 / accumulated=使用中积累 / ingested=多源摄入(insights/audit/PR/git/CI) / team-shared=团队审核后共享 / internet=互联网(Phase 4) */
  source: z.enum([
    "preset",
    "imported",
    "accumulated",
    "ingested",
    "team-shared",
    "internet",
  ]),

  /** 与本条冲突的其他条目 id 列表 */
  conflict_with: z.array(z.string()).default([]),

  /** v2 Tier system — promotion/demotion decisions */
  current_tier: z
    .enum(["experimental", "probation", "stable", "canonical", "enforced", "dormant"])
    .default("experimental"),
  /** Historical max tier (selects half-life for decay) */
  max_tier_ever: z
    .enum(["experimental", "probation", "stable", "canonical", "enforced"])
    .default("experimental"),
  /** Timestamp when current tier was entered (for hysteresis duration check) */
  tier_entered_at: z.string().default(""),
  /** Demerit accumulation (driver's license penalty system) */
  demerit: z.number().nonnegative().default(0),
  /** When demerit was last changed (for decay calculation) */
  demerit_last_updated: z.string().default(""),
  /** Number of times rule was revived from dormant (3 = permanent archive) */
  resurrect_count: z.number().int().nonnegative().default(0),
});

export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;

/**
 * 根据 confidence 和 nature 自动推导 enforcement。
 * 规则见 spec v5.2 "置信度与执行强度" 表。
 */
export function computeEnforcement(
  confidence: number,
  nature: "objective" | "subjective",
): "block" | "warn" | "suggest" | "passive" {
  if (confidence < 0.5) return "passive";
  if (confidence < 0.7) return "suggest";
  if (confidence < 0.9) return "warn";
  // subjective 知识 enforcement 上限为 warn
  if (nature === "subjective") return "warn";
  return "block";
}
