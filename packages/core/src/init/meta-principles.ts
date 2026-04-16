import type { KnowledgeEntry } from "@teamagent/types";

/**
 * 元原则（meta-principles）：每次 `teamagent init` 会注入的一组普适规则。
 *
 * 设计约束：
 * - source = "preset"
 * - scope.level = "global"（跨项目生效，但只在用户本机）
 * - 全部是 practice 型（advisory），不走 hook 拦截——元原则太普适，做不到精准
 *   wrong_pattern；只在 CLAUDE.md 里展示供 AI 参考
 * - confidence=0.6（suggest 档）：新用户可以按自己习惯 override/archive
 *
 * 如何修改：直接编辑本文件。用户可以在 init 后 `teamagent review` 看到、
 * 用 `teamagent pitfall` 记录自己的替代版本覆盖。
 */
export function getMetaPrinciples(
  now: () => Date = () => new Date(),
): KnowledgeEntry[] {
  const created = now().toISOString();
  return [
    makePreset({
      id: "preset-tdd-cycle",
      category: "S",
      tags: ["tdd", "workflow"],
      trigger: "开始实现一个新功能",
      correct: "先写失败测试（红）→ 写最小实现（绿）→ 重构（如需）→ commit",
      reason: "TDD 让接口设计先行，测试与实现紧耦合；避免写完实现才发现接口难用",
      created,
    }),
    makePreset({
      id: "preset-small-commits",
      category: "S",
      tags: ["git", "workflow"],
      trigger: "准备 git commit 时",
      correct: "一个 commit 只做一件概念上完整的事，tests 要过；commit message 说清'做了什么+为什么'",
      reason: "小 commit 让 review 容易、回滚粒度细、git bisect 有意义；批量提交会让 bug 定位变噩梦",
      created,
    }),
    makePreset({
      id: "preset-pitfall-cli",
      category: "K",
      tags: ["teamagent", "knowledge-capture"],
      trigger: "想记录一条团队踩坑经验给将来的 AI 和同事参考",
      correct: "用 teamagent pitfall（交互）或 teamagent pitfall --non-interactive --trigger=... --correct=... 录入；不要手工编辑 .teamagent/knowledge.jsonl",
      reason: "pitfall 命令会补齐 id/时间戳/scope/enforcement 等字段并触发 CLAUDE.md 重编译；手工编辑容易写出不合 schema 的条目、忘记重新编译",
      created,
    }),
    makePreset({
      id: "preset-prefer-edit-over-create",
      category: "S",
      tags: ["scope", "workflow"],
      trigger: "准备新建一个文件完成某任务时",
      correct: "先确认项目里有没有已有文件能承载该改动；优先编辑现有文件，只在真的需要时才新建",
      reason: "不必要的新文件会让 reviewer 分心、让 import 关系复杂；大多数小改动应该在现有模块里完成",
      created,
    }),
  ];
}

function makePreset(args: {
  id: string;
  category: "C" | "E" | "S" | "K";
  tags: string[];
  trigger: string;
  correct: string;
  reason: string;
  created: string;
}): KnowledgeEntry {
  return {
    id: args.id,
    scope: { level: "global" },
    category: args.category,
    tags: args.tags,
    type: "practice",
    nature: "subjective",
    trigger: args.trigger,
    wrong_pattern: "",
    correct_pattern: args.correct,
    reasoning: args.reason,
    confidence: 0.6,
    enforcement: "suggest",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: args.created,
    last_hit_at: "",
    last_validated_at: args.created,
    source: "preset",
    conflict_with: [],
    current_tier: "experimental" as const,
    max_tier_ever: "experimental" as const,
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
  };
}
