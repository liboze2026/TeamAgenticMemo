import type {
  SuccessDetector,
  SuccessSignal,
  SuccessSignalType,
} from "@teamagent/ports";
import type { ParsedSession, SessionTurn, ToolCall } from "@teamagent/types";

/**
 * 显式表扬关键词。
 * 权重参考 spec v5.2 "成功信号" 表（0.80）。
 */
const PRAISE_PATTERNS: RegExp[] = [
  /完美|就是这样|就这样|很好|赞|不错|太棒|搞定|👍|挺好/,
  /\b(perfect|great|nice|excellent|exactly|works?|lgtm|awesome)\b/i,
];

/**
 * 纠正关键词（success detector 需要识别是否被纠正，以决定是否算 one_shot）
 */
const DENIAL_PATTERNS: RegExp[] = [
  /不对|错了|不要|别这样|别那样|别用|思路不对|方向不对|换[一个种]|改用|重来|重新|不该|不应该/,
  /\b(no|wrong|don't|not|never|instead|that'?s wrong)\b/i,
];

function isDenial(text: string): boolean {
  return DENIAL_PATTERNS.some((p) => p.test(text));
}

function isPraise(text: string): boolean {
  return PRAISE_PATTERNS.some((p) => p.test(text));
}

/**
 * 工具调用的"意图类别"——用于 repeated_pattern 判定。
 * 粗粒度：同工具 + 同 file_type 扩展名 视为同类。
 */
function categorizeToolCall(tc: ToolCall): string {
  const input = tc.input as Record<string, unknown>;
  const fp = typeof input.file_path === "string" ? input.file_path : "";
  const ext = fp.match(/\.(\w+)$/)?.[1] ?? "-";
  return `${tc.name}:${ext}`;
}

/**
 * 规则版成功信号识别器（纯函数）。
 */
export const ruleBasedSuccessDetector: SuccessDetector = {
  detect(session: ParsedSession): SuccessSignal[] {
    const out: SuccessSignal[] = [];

    // 标记哪些 turn 是被纠正的（后续 user message 含否定词 → 前一 turn 有问题）
    const correctedTurns = new Set<number>();
    for (let i = 1; i < session.turns.length; i++) {
      if (isDenial(session.turns[i]!.userMessage)) {
        correctedTurns.add(i - 1);
      }
    }

    // Signal A: explicit_praise — user 后续 message 里有表扬词
    for (let i = 1; i < session.turns.length; i++) {
      const turn = session.turns[i]!;
      if (isPraise(turn.userMessage) && !isDenial(turn.userMessage)) {
        // 表扬一般指向前一 turn（AI 做的事）
        const prev = session.turns[i - 1];
        out.push({
          signal: "explicit_praise",
          weight: 0.8,
          turnIndex: i - 1,
          assistantText: prev?.assistantText ?? "",
          toolCalls: (prev?.toolCalls ?? []).map(summarizeToolCall),
          timestamp: prev?.timestamp ?? turn.timestamp,
        });
      }
    }

    // Signal B: one_shot_success — AI 做了事 + 用户没纠正（进入下一个任务）
    // 判定：turn i 的 AI 有 tool_use；turn i+1 存在；turn i+1 不是 denial
    // 且 turn i 本身没被 correctedTurns 标记
    for (let i = 0; i < session.turns.length; i++) {
      const turn = session.turns[i]!;
      const next = session.turns[i + 1];
      if (!next) continue;
      if (turn.toolCalls.length === 0) continue;
      if (correctedTurns.has(i)) continue;
      if (isDenial(next.userMessage)) continue;
      // 避免和 explicit_praise 重复上报
      if (isPraise(next.userMessage)) continue;
      out.push({
        signal: "one_shot_success",
        weight: 0.3,
        turnIndex: i,
        assistantText: turn.assistantText,
        toolCalls: turn.toolCalls.map(summarizeToolCall),
        timestamp: turn.timestamp,
      });
    }

    // Signal C: repeated_pattern — 同一工具 + 文件类型 重复 ≥3 次且无纠正
    const patternCount = new Map<string, number[]>();
    for (const turn of session.turns) {
      if (correctedTurns.has(turn.turnIndex)) continue;
      for (const tc of turn.toolCalls) {
        const cat = categorizeToolCall(tc);
        if (!patternCount.has(cat)) patternCount.set(cat, []);
        patternCount.get(cat)!.push(turn.turnIndex);
      }
    }
    for (const [cat, turnIndices] of patternCount.entries()) {
      if (turnIndices.length < 3) continue;
      // 对最早那次报一条 repeated_pattern signal（代表整个模式被重复采用）
      out.push({
        signal: "repeated_pattern",
        weight: 0.6,
        turnIndex: turnIndices[0]!,
        assistantText: session.turns[turnIndices[0]!]?.assistantText ?? "",
        toolCalls: [cat + ` × ${turnIndices.length}`],
        timestamp: session.turns[turnIndices[0]!]?.timestamp ?? "",
      });
    }

    out.sort((a, b) => a.turnIndex - b.turnIndex);
    return out;
  },
};

function summarizeToolCall(tc: ToolCall): string {
  const keys = Object.keys(tc.input).slice(0, 3);
  return `${tc.name}(${keys.join(",")})`;
}
