import type { KnowledgeEntry } from "@teamagent/types";
import { scoreEntry } from "../scorer.js";

/**
 * CLAUDE.md 的 TEAMAGENT 标记。
 * 用户在标记之外的内容永远不会被动到。
 */
export const BLOCK_START = "<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->";
export const BLOCK_END = "<!-- TEAMAGENT:END -->";

/** 总行数上限（含 START + header + END 标记行）。对齐 spec v5.2。 */
const MAX_LINES = 50;
/** 扣除 header / footer / 空行留的 content 预算。 */
const CONTENT_BUDGET = MAX_LINES - 5;

/**
 * 把一条 KnowledgeEntry 渲染为一行 markdown bullet。纯函数。
 */
function formatEntry(entry: KnowledgeEntry): string {
  const conf = entry.confidence.toFixed(2);
  const hits = entry.hit_count > 0 ? `, ${entry.hit_count}次命中` : "";
  const sourceTag =
    entry.source === "team-shared" ? " [团队]" : entry.source === "preset" ? " [预置]" : "";

  if (entry.type === "avoidance" && entry.wrong_pattern) {
    return `- 使用 ${entry.correct_pattern} 而非 ${entry.wrong_pattern}——${entry.reasoning} [${conf}${hits}]${sourceTag}`;
  }
  return `- ${entry.correct_pattern}——${entry.reasoning} [${conf}${hits}]${sourceTag}`;
}

/**
 * 把知识条目编译为 CLAUDE.md 区块文本（含 START/END 标记）。纯函数。
 *
 * @param entries - 候选条目（archived 会被过滤掉）
 * @param now - 当前时间（ISO 8601），用于 recency 评分
 */
export function compileMarkdownBlock(
  entries: KnowledgeEntry[],
  now: string,
): string {
  const active = entries.filter((e) => e.status === "active");

  if (active.length === 0) {
    return [BLOCK_START, "## TeamAgent 经验", "暂无经验，使用过程中会自动积累。", BLOCK_END].join("\n");
  }

  // 按综合分数排序（block 优先通过 enforcement 权重体现）
  const maxHitCount = Math.max(1, ...active.map((e) => e.hit_count));
  const sorted = active
    .map((e) => ({ entry: e, score: scoreEntry(e, maxHitCount, now) }))
    .sort((a, b) => b.score - a.score);

  const lines: string[] = [];
  for (const { entry } of sorted) {
    if (lines.length >= CONTENT_BUDGET) break;
    lines.push(formatEntry(entry));
  }

  const total = active.length;
  const shown = lines.length;
  const header =
    total > shown
      ? `## TeamAgent 经验（${total}条活跃知识，为你编译了Top ${shown}）`
      : `## TeamAgent 经验（${total}条活跃知识）`;

  return [BLOCK_START, header, ...lines, BLOCK_END].join("\n");
}

/**
 * 把 block 注入到已有文档（CLAUDE.md）中。纯函数。
 *
 * - 文档已有 START/END 标记：替换其中内容
 * - 文档没有标记：追加到末尾，前加空行分隔
 * - 空文档：只返回 block，末尾保证一个换行
 */
export function injectBlockIntoDoc(existing: string, block: string): string {
  const startIdx = existing.indexOf(BLOCK_START);
  const endIdx = existing.indexOf(BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + BLOCK_END.length);
    return before + block + after;
  }

  if (existing === "") {
    return block + "\n";
  }

  const trimmed = existing.replace(/\n+$/, "");
  return trimmed + "\n\n" + block + "\n";
}
