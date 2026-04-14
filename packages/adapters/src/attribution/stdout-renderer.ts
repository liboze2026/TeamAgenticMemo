import type { AttributionEvent, VisibilityMode } from "@teamagent/types";
import type { Renderer } from "@teamagent/ports";

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
const HEADER = "✨ TeamAgent · 本次操作归因";

/** 从 before/after 数值生成"X → Y"表达 */
function describeChange(before: unknown, after: unknown): string | undefined {
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    const bRec = before as Record<string, unknown>;
    const aRec = after as Record<string, unknown>;
    if (
      typeof bRec.knowledgeCount === "number" &&
      typeof aRec.knowledgeCount === "number"
    ) {
      const b = bRec.knowledgeCount;
      const a = aRec.knowledgeCount;
      const tag = typeof aRec.categoryTag === "string" ? ` (${aRec.categoryTag})` : "";
      return `${b} → ${a} 条${tag}`;
    }
  }
  return undefined;
}

/** 从 target 字段生成"传播到"表达 */
function describeTarget(target: AttributionEvent["target"]): string | undefined {
  if (!target) return undefined;
  const parts: string[] = [];
  if (target.file) {
    if (typeof target.count === "number") {
      parts.push(`${target.file} 第 ${target.count} 行`);
    } else {
      parts.push(target.file);
    }
  }
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

/**
 * 归因事件→文本 渲染器。
 *
 * 模式对应 spec v5.2 和 plan v1.2 的归因总线规范：
 * - silent：返回空串
 * - smart: 只显示 highlight/warning 的完整归因块
 * - verbose: + counterfactual + 附加原始 JSON
 */
export class StdoutRenderer implements Renderer {
  render(events: AttributionEvent[], mode: VisibilityMode): string {
    if (mode === "silent") return "";

    const visible = mode === "verbose"
      ? events
      : events.filter((e) => e.severity !== "info");

    if (visible.length === 0) return "";

    const lines: string[] = [DIVIDER, HEADER, DIVIDER];

    for (const e of visible) {
      lines.push(`▸ 做了什么: ${e.action}`);

      const change = describeChange(e.before, e.after);
      if (change) lines.push(`▸ 知识库变化: ${change}`);

      const target = describeTarget(e.target);
      if (target) lines.push(`▸ 传播到: ${target}`);

      if (e.userFacingValue) {
        lines.push(`▸ 下次体验: ${e.userFacingValue}`);
      }
      if (mode === "verbose" && e.counterfactual) {
        lines.push(`▸ 如果没有 TeamAgent: ${e.counterfactual}`);
      }
    }

    lines.push(DIVIDER);

    if (mode === "verbose") {
      lines.push("");
      lines.push("--- raw events ---");
      lines.push(JSON.stringify(events, null, 2));
    }

    return lines.join("\n");
  }
}
