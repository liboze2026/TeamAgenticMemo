/** 供 detectIgnoredSignals / detectCompliedSignals 使用的最小事件结构。
 *  不依赖 PersistedEvent，让 core 保持无类型耦合。
 */
export interface OverrideSignalEvent {
  kind: string;
  tool_use_id?: string;
  knowledge_id?: string;
  timestamp: string;
  /** 存在于 hook-pre.warned 事件的 payload 里（M2.5 新增）。 */
  tool_name?: string;
}

/**
 * PostToolUse 用：当同一 tool_use_id 有 hook-pre.warned 事件时，
 * 说明 AI 被警告后仍执行了原始工具调用 → "ignored"。
 */
export function detectIgnoredSignals(
  currentToolUseId: string,
  recentEvents: OverrideSignalEvent[],
): Array<{ knowledge_id: string }> {
  return recentEvents
    .filter(
      (e) =>
        e.kind === "hook-pre.warned" &&
        e.tool_use_id === currentToolUseId &&
        Boolean(e.knowledge_id),
    )
    .map((e) => ({ knowledge_id: e.knowledge_id! }));
}

/**
 * PreToolUse 用（clean pass 时调用）：在近期 warned 事件里找同 tool_name 的，
 * 推断 AI 在下次调用同类工具时改掉了之前触发警告的内容 → "complied"。
 *
 * @param currentToolName  当前 clean pass 的工具名
 * @param recentEvents     事件日志最近 N 条（调用方传入，通常 50）
 * @param now              当前时间（纯函数，不内部 new Date()）
 * @param windowMs         时间窗口，默认 5 分钟
 */
export function detectCompliedSignals(
  currentToolName: string,
  recentEvents: OverrideSignalEvent[],
  now: Date,
  windowMs = 300_000,
): Array<{ knowledge_id: string }> {
  const cutoff = now.getTime() - windowMs;
  const seen = new Set<string>();
  const result: Array<{ knowledge_id: string }> = [];

  for (const e of recentEvents) {
    if (
      e.kind === "hook-pre.warned" &&
      e.knowledge_id &&
      e.tool_name === currentToolName &&
      new Date(e.timestamp).getTime() > cutoff &&
      !seen.has(e.knowledge_id)
    ) {
      seen.add(e.knowledge_id);
      result.push({ knowledge_id: e.knowledge_id });
    }
  }

  return result;
}
