import type {
  CorrectionDetector,
  CorrectionMoment,
  CorrectionSignal,
} from "@teamagent/ports";
import type { ParsedSession, SessionTurn, ToolCall } from "@teamagent/types";

/**
 * 显式否定关键词。
 *
 * 设计说明：
 * - 中文：逐字精确匹配。"不对"/"错了"/"别这样"/"不要"/"换个"/"重来"
 * - 英文：整词匹配（用 \b 防止 "know" 命中 "no"）
 * - 故意不收录 "不是"——太宽泛（"我的意思不是..."）
 */
const DENIAL_PATTERNS: Array<{ re: RegExp; weight: number }> = [
  // 中文：高置信
  { re: /不对/, weight: 0.95 },
  { re: /错了/, weight: 0.95 },
  { re: /不要/, weight: 0.95 },
  { re: /别这样|别那样|别用|别这么/, weight: 0.95 },
  { re: /重来|重新/, weight: 0.9 },
  { re: /换[一个种]|换成|改用|改成/, weight: 0.9 },
  { re: /思路不对|方向不对/, weight: 0.95 },
  { re: /不该|不应该/, weight: 0.9 },
  // 英文：整词
  { re: /\b(no|wrong|don't|not|never)\b/i, weight: 0.9 },
  { re: /\binstead\b/i, weight: 0.9 },
  { re: /\bthat'?s wrong\b/i, weight: 0.95 },
];

/**
 * 失败信号：同一个 turn 内有 ≥1 次失败的 tool call。
 */
function hasMultipleFailures(turn: SessionTurn): boolean {
  const failed = turn.toolCalls.filter((tc) => tc.succeeded === false);
  return failed.length >= 1;
}

/**
 * 规则版纠正时刻识别器（纯函数）。
 * 仅用关键词 + 工具调用统计，不依赖 LLM。
 */
export const ruleBasedCorrectionDetector: CorrectionDetector = {
  detect(session: ParsedSession): CorrectionMoment[] {
    const out: CorrectionMoment[] = [];

    for (let i = 0; i < session.turns.length; i++) {
      const turn = session.turns[i]!;
      const prevTurn = i > 0 ? session.turns[i - 1] : undefined;

      // Signal A: 用户 message 里含显式否定词
      const denial = matchDenial(turn.userMessage);
      if (denial && prevTurn) {
        out.push(buildMoment(turn, prevTurn, "explicit_denial", denial.weight));
      }

      // Signal B: 上一 turn 有工具失败 —— 无论用户是否介入都触发。
      // 权重根据用户是否说话分档:
      //   - 用户介入 (0.85) → 更可能是真·纠正时刻
      //   - 用户沉默 (0.70) → 可能是 AI 自己重试中；交给 LLM 二次判断,
      //     prompt 会在信息不足时返回 null
      if (prevTurn && hasMultipleFailures(prevTurn)) {
        const already = out.find((m) => m.turnIndex === i);
        if (!already) {
          const userSpoke = turn.userMessage.trim().length > 0;
          const weight = userSpoke ? 0.85 : 0.70;
          out.push(buildMoment(turn, prevTurn, "multi_failure", weight));
        }
      }

      // Signal C: suggestion_override — AI 建议某方案，用户指定另一个
      // 简化规则：上一 turn assistant 提到"推荐/用/建议"某工具/库，用户说"用 Y 吧"
      if (prevTurn && !out.find((m) => m.turnIndex === i)) {
        const override = detectOverride(prevTurn.assistantText, turn.userMessage);
        if (override) {
          out.push(buildMoment(turn, prevTurn, "suggestion_override", 0.8));
        }
      }

      // Signal D: code_edit — 用户告诉 AI 自己改了代码 / 当前 turn AI 用 Edit 替换
      const codeEdit = detectCodeEdit(turn);
      if (codeEdit && !out.find((m) => m.turnIndex === i)) {
        out.push(buildMoment(turn, prevTurn, "code_edit", 0.8));
      }

      // Signal E: error_in_context — user pastes an error trace/message and the
      // previous turn had AI tool calls (i.e., AI caused the error or was involved).
      // This catches the common pattern: AI does something → error → user pastes error.
      if (prevTurn && !out.find((m) => m.turnIndex === i)) {
        const hasError = detectErrorInMessage(turn.userMessage);
        const prevHadToolUse = prevTurn.toolCalls.length > 0;
        if (hasError && prevHadToolUse) {
          out.push(buildMoment(turn, prevTurn, "multi_failure", 0.8));
        }
      }
    }

    // 按 turnIndex 升序排序
    out.sort((a, b) => a.turnIndex - b.turnIndex);
    return out;
  },
};

function matchDenial(text: string): { weight: number } | null {
  if (!text.trim()) return null;
  let maxWeight = 0;
  for (const p of DENIAL_PATTERNS) {
    if (p.re.test(text)) {
      if (p.weight > maxWeight) maxWeight = p.weight;
    }
  }
  return maxWeight > 0 ? { weight: maxWeight } : null;
}

/**
 * 识别 suggestion_override：
 * AI 的上一段建议了某工具 X（出现在 "推荐" / "用 X" / "我用 X" 句式里），
 * 用户的回复指定了另一个工具 Y（"用 Y" / "改用 Y" / "Y 更好"）。
 * 简化启发：只要检测到用户在用 AI 没提的某个常见库/工具名就算。
 */
function detectOverride(assistantText: string, userText: string): boolean {
  if (!userText.trim()) return false;

  // 用户明确表达"用 Y" / "Y 更好" / "上 Y" / "改用 Y"
  // 注：\b 不匹配中文边界，中文前缀直接匹配
  const userSpecifies =
    /(用|改用|上)\s*[A-Za-z][\w-]{1,}/.test(userText) ||
    /[A-Za-z][\w-]{1,}\s*(更好|轻量|简单)/i.test(userText);
  if (!userSpecifies) return false;

  // 从用户 message 里抓所有可能的工具/库名
  const userToolMatch = userText.match(/[A-Za-z][A-Za-z-]{2,}/g);
  if (!userToolMatch) return false;

  // 前提：assistant 上一段确实推荐过某个方案
  const assistantSuggested =
    /推荐|建议|我用|我来用|install|add\s+[A-Za-z]|[A-Za-z][\w-]{2,}\s*是/i.test(
      assistantText,
    );
  if (!assistantSuggested) return false;

  // 用户提到的某个工具不在 assistant 之前说过的内容里 → override
  const assistantLower = assistantText.toLowerCase();
  const STOP = new Set([
    "the", "and", "for", "but", "more", "less", "less",
  ]);
  for (const tool of userToolMatch) {
    if (tool.length < 3) continue;
    if (STOP.has(tool.toLowerCase())) continue;
    if (!assistantLower.includes(tool.toLowerCase())) return true;
  }
  return false;
}

const ERROR_PATTERNS: RegExp[] = [
  /\bError\s*:/i,
  /\bException\s*:/i,
  /\bE[A-Z]{3,}\b/, // ENOENT, EACCES, EPERM, EBUSY, etc.
  /at\s+\S+\s*\(\S+:\d+:\d+\)/, // JS stack trace frame
  /Traceback \(most recent call last\)/,
  /SyntaxError|TypeError|ReferenceError|RangeError/,
  /FAILED|✗|✕/, // test failures
  /exit code [1-9]|exit status [1-9]/i,
  /报错|错误|异常|失败/, // Chinese error keywords
];

/**
 * Returns true when the user message appears to contain an error message / stack trace.
 * Conservative: requires ≥1 strong pattern match (not just any line with "Error").
 */
function detectErrorInMessage(text: string): boolean {
  if (!text.trim()) return false;
  for (const re of ERROR_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

/**
 * 识别 code_edit：user 在当前 turn 说"我改了" / 或当前 turn 的 AI Edit
 * 是替换用户贴来的完整版本（new_string 远长于 old_string）。
 * 判当前 turn 而非 next turn —— 语义是"user 在这 turn 改了"。
 */
function detectCodeEdit(turn: SessionTurn): boolean {
  if (/我改了|我重写了|你看我改/i.test(turn.userMessage)) return true;
  for (const tc of turn.toolCalls) {
    if (tc.name !== "Edit") continue;
    const inp = tc.input as { old_string?: unknown; new_string?: unknown };
    const oldStr = typeof inp.old_string === "string" ? inp.old_string : "";
    const newStr = typeof inp.new_string === "string" ? inp.new_string : "";
    if (newStr.length > oldStr.length * 2 && newStr.length > 200) return true;
  }
  return false;
}

function buildMoment(
  turn: SessionTurn,
  prevTurn: SessionTurn | undefined,
  signal: CorrectionSignal,
  weight: number,
): CorrectionMoment {
  return {
    signal,
    weight,
    turnIndex: turn.turnIndex,
    correctionText: turn.userMessage,
    previousAssistantText: prevTurn?.assistantText ?? "",
    previousToolCalls: (prevTurn?.toolCalls ?? []).map(summarizeToolCall),
    timestamp: turn.timestamp,
  };
}

function summarizeToolCall(tc: ToolCall): string {
  const keys = Object.keys(tc.input).slice(0, 3);
  const head = `${tc.name}(${keys.join(",")})`;
  if (tc.succeeded === false) {
    // 把失败工具的 stderr/result 前 200 字纳入摘要,
    // 让后续 LLM 看到实际错误内容再判断要不要提规则
    const err = typeof tc.result === "string" ? tc.result.trim().slice(0, 200) : "";
    return err ? `${head} ✗ ${err}` : `${head} ✗ FAILED`;
  }
  return head;
}
