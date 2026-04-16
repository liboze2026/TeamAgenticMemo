import {
  InMemoryKnowledgeStore,
  InMemoryAttributionBus,
  StdoutRenderer,
} from "@teamagent/adapters";
import { compileMarkdownBlock } from "@teamagent/core";
import { parseVisibilityMode, type KnowledgeEntry } from "@teamagent/types";

/**
 * M0 Walking Skeleton 演示命令。
 *
 * 跑一次"录入 → 编译 → 渲染归因"的完整内存回路，证明所有 Port
 * 的 Fake 实现能组合工作。所有输出都经过 AttributionBus + Renderer，
 * 无任何直接 console.log——这是原则 6 的强制落地。
 *
 * Visibility mode 由环境变量 TEAMAGENT_VISIBILITY 控制。
 */
export function runSkeletonDemo(
  opts: {
    env?: Record<string, string | undefined>;
    now?: string;
  } = {},
): string {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date().toISOString();
  const mode = parseVisibilityMode(env.TEAMAGENT_VISIBILITY);

  const store = new InMemoryKnowledgeStore();
  const bus = new InMemoryAttributionBus();

  // 模拟一条预置元原则
  const entry: KnowledgeEntry = {
    id: "skeleton-demo-001",
    scope: { level: "personal" },
    category: "K",
    tags: ["metacognition", "skeleton"],
    type: "practice",
    nature: "subjective",
    trigger: "遇到预期外的状态",
    wrong_pattern: "",
    correct_pattern: "先停下查清楚根因，再动手",
    reasoning: "绕过式修复经常掩盖真问题",
    confidence: 0.8,
    enforcement: "suggest",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: now,
    last_hit_at: "",
    last_validated_at: now,
    source: "preset",
    conflict_with: [],
    current_tier: "experimental" as const,
    max_tier_ever: "experimental" as const,
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
  };
  store.add(entry);

  const block = compileMarkdownBlock(store.getAll(), now);
  const lineCount = block.split("\n").length;

  bus.emit({
    source: "skeleton",
    action: "[skeleton] 添加模拟知识 + 模拟编译",
    severity: "highlight",
    timestamp: now,
    target: { id: entry.id, count: store.count() },
    before: { knowledgeCount: 0 },
    after: { knowledgeCount: store.count(), blockLines: lineCount },
    userFacingValue: `模拟知识条目已编译成 ${lineCount} 行 markdown，真实场景下会写入 CLAUDE.md`,
    counterfactual: "没有 Walking Skeleton 的骨架贯通，后续 Milestone 没有落脚点",
  });

  const renderer = new StdoutRenderer();
  return renderer.render(bus.drain(), mode);
}
