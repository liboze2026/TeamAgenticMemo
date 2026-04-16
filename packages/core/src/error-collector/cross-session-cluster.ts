import type { RawErrorSignal } from "@teamagent/ports";

/**
 * H 信号聚类：从一批原始信号中找出在 ≥minSessions 个不同 session 里出现的关键词，
 * 聚合成 H 类型信号返回。
 *
 * 纯函数——不依赖任何 IO。
 */
export function clusterByTag(
  signals: RawErrorSignal[],
  minSessions: number,
): RawErrorSignal[] {
  if (signals.length === 0) return [];

  const keywordSessions = new Map<string, Set<string>>();

  for (const sig of signals) {
    const tokens = tokenize(sig.context);
    const sessionId = sig.sessionIds[0] ?? "unknown";
    for (const token of tokens) {
      if (!keywordSessions.has(token)) {
        keywordSessions.set(token, new Set());
      }
      keywordSessions.get(token)!.add(sessionId);
    }
  }

  const result: RawErrorSignal[] = [];

  for (const [keyword, sessionSet] of keywordSessions.entries()) {
    if (sessionSet.size < minSessions) continue;

    const sessionIds = Array.from(sessionSet);
    const matchingSignals = signals.filter(
      (s) => s.context.toLowerCase().includes(keyword),
    );

    const weight = Math.min(sessionSet.size / 5, 1);

    const contextSummary = [
      `[H 聚类] 关键词 "${keyword}" 在 ${sessionSet.size} 个不同 session 中重复出现`,
      `相关上下文片段：`,
      ...matchingSignals
        .slice(0, 3)
        .map((s) => `  - ${s.context.slice(0, 120)}`),
    ].join("\n");

    result.push({
      id: `h-${keyword}-${sessionIds.slice(0, 3).join("-")}`,
      signalType: "H",
      weight,
      sessionIds,
      context: contextSummary,
      suggestedCategory: undefined,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have",
  "error", "fail", "failed", "failure", "could", "would", "should",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_./\\:,;()[\]{}'"!?]+/)
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
}
