import type {
  ParsedSession,
  RawAssistantContentBlock,
  RawSessionMessage,
  SessionTurn,
  ToolCall,
} from "@teamagent/types";

/**
 * 把 Claude Code 会话日志文本（jsonl）解析为 ParsedSession。纯函数。
 *
 * 会话文件位置：~/.claude/projects/{project-id}/{session-id}.jsonl
 * 每行一个 JSON，type 区分消息类别（user/assistant/system/tool_result 等）。
 *
 * 解析策略：
 * - 按行 parse，跳过坏行
 * - 每遇到 user 消息开新 turn
 * - 之后的 assistant 消息追加进当前 turn（text 拼接、tool_use 累积）
 * - tool_result 通过 tool_use_id 关联回 tool call（并启发式判定 succeeded）
 */
export function parseSessionFile(raw: string): ParsedSession {
  const messages: RawSessionMessage[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed) as RawSessionMessage);
    } catch {
      continue;
    }
  }

  const toolResults = new Map<string, { content: string; succeeded: boolean }>();
  for (const m of messages) {
    if (m.type !== "assistant" || !m.message) continue;
    const blocks = (m.message as { content?: unknown }).content;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks as RawAssistantContentBlock[]) {
      if (b.type === "tool_result") {
        const c = String(b.content ?? "");
        toolResults.set(b.tool_use_id, {
          content: c,
          succeeded: !/\b(error|err!|failed|not found|exit code [1-9])/i.test(c),
        });
      }
    }
  }

  const turns: SessionTurn[] = [];
  let currentTurn: SessionTurn | null = null;
  let sessionId = "unknown";

  for (const m of messages) {
    if (m.sessionId) sessionId = m.sessionId;

    if (m.type === "user" && m.message) {
      if (currentTurn) turns.push(currentTurn);
      const userText =
        typeof (m.message as { content?: unknown }).content === "string"
          ? String((m.message as { content: string }).content)
          : "";
      currentTurn = {
        turnIndex: turns.length,
        userMessage: userText,
        assistantText: "",
        toolCalls: [],
        timestamp: m.timestamp ?? "",
      };
    } else if (m.type === "assistant" && m.message) {
      if (!currentTurn) continue;
      const blocks = (m.message as { content?: unknown }).content;
      if (!Array.isArray(blocks)) continue;
      for (const b of blocks as RawAssistantContentBlock[]) {
        if (b.type === "text") {
          if (currentTurn.assistantText) currentTurn.assistantText += "\n";
          currentTurn.assistantText += b.text;
        } else if (b.type === "tool_use") {
          const tc: ToolCall = {
            id: b.id,
            name: b.name,
            input: b.input,
          };
          const tr = toolResults.get(b.id);
          if (tr) {
            tc.result = tr.content;
            tc.succeeded = tr.succeeded;
          }
          currentTurn.toolCalls.push(tc);
        }
      }
    }
  }
  if (currentTurn) turns.push(currentTurn);

  return {
    sessionId,
    turns,
    startTime: turns[0]?.timestamp ?? "",
    endTime: turns[turns.length - 1]?.timestamp ?? "",
  };
}
