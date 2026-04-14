import type { AttributionEvent, VisibilityMode } from "@teamagent/types";
import type { Renderer } from "@teamagent/ports";

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
const HEADER = "✨ TeamAgent · 本次操作归因";

/**
 * 归因事件→文本 渲染器。
 *
 * 模式对应 spec v5.2 和 plan v1.2 的归因总线规范：
 * - silent：返回空串
 * - smart: 只显示 highlight/warning 的 action + userFacingValue
 * - verbose: 显示所有 severity + counterfactual + 附加原始 JSON
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
