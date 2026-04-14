import fsPromises from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import type {
  ParsedSession,
  RawAssistantContentBlock,
  RawSessionMessage,
  SessionTurn,
  ToolCall,
} from "@teamagent/types";
import type { SessionSource } from "@teamagent/ports";

/**
 * 从 ~/.claude/projects/{project-dir}/*.jsonl 加载 Claude Code 会话日志。
 *
 * 日志结构（实测 Claude Code 2.1.x 实际格式）:
 *   {type:"user", message:{role:"user", content:"..."}}
 *   {type:"assistant", message:{role:"assistant", content:[{type:"text"...},{type:"tool_use"...}]}}
 *   {type:"assistant", message:{role:"assistant", content:[{type:"tool_result","tool_use_id":"t1","content":"..."}]}}
 *
 * 解析策略:
 * - 把 user/assistant 消息按时间顺序遍历
 * - 每遇到 user 消息开一个新 turn
 * - 之后的 assistant 消息追加到 turn（文本拼接、tool_use 累积、tool_result 匹配到 tool_use）
 */
export class ClaudeSessionSource implements SessionSource {
  /**
   * @param projectsRoot Claude Code 会话根目录，默认 ~/.claude/projects
   */
  constructor(private readonly projectsRoot: string) {}

  async listRecent(
    limit = 10,
  ): Promise<Array<{ sessionId: string; startTime: string; turnCount: number }>> {
    if (!fsSync.existsSync(this.projectsRoot)) return [];

    const files: Array<{ file: string; mtime: number }> = [];
    const projectDirs = await fsPromises.readdir(this.projectsRoot);
    for (const pd of projectDirs) {
      const projPath = path.join(this.projectsRoot, pd);
      let stat: fsSync.Stats;
      try {
        stat = await fsPromises.stat(projPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const entries = await fsPromises.readdir(projPath);
      for (const entry of entries) {
        if (!entry.endsWith(".jsonl")) continue;
        const full = path.join(projPath, entry);
        try {
          const fileStat = await fsPromises.stat(full);
          files.push({ file: full, mtime: fileStat.mtimeMs });
        } catch {
          continue;
        }
      }
    }

    files.sort((a, b) => b.mtime - a.mtime);
    const top = files.slice(0, limit);

    const result: Array<{ sessionId: string; startTime: string; turnCount: number }> = [];
    for (const { file } of top) {
      try {
        const session = await this.loadById(file);
        result.push({
          sessionId: session.sessionId,
          startTime: session.startTime,
          turnCount: session.turns.length,
        });
      } catch {
        continue;
      }
    }
    return result;
  }

  async loadById(sessionIdOrPath: string): Promise<ParsedSession> {
    const filePath = fsSync.existsSync(sessionIdOrPath)
      ? sessionIdOrPath
      : await this.resolveSessionFile(sessionIdOrPath);

    const raw = await fsPromises.readFile(filePath, "utf-8");
    return parseSessionFile(raw);
  }

  private async resolveSessionFile(sessionId: string): Promise<string> {
    if (!fsSync.existsSync(this.projectsRoot)) {
      throw new Error(`Projects root not found: ${this.projectsRoot}`);
    }
    const projectDirs = await fsPromises.readdir(this.projectsRoot);
    for (const pd of projectDirs) {
      const candidate = path.join(this.projectsRoot, pd, `${sessionId}.jsonl`);
      if (fsSync.existsSync(candidate)) return candidate;
    }
    throw new Error(`Session not found: ${sessionId}`);
  }
}

/**
 * 纯函数版：给定 jsonl 文件内容，返回 ParsedSession。
 * 导出以便测试/其他 adapter 复用（无 IO）。
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

  // 累积 tool_result 便于 turn 回填 succeeded 状态
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
          // 简易启发：stderr/失败关键词在结果里 → succeeded=false
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
      // 开新 turn
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
      if (!currentTurn) continue; // 没 user 就来的 assistant 消息跳过
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
        // tool_result 在 toolResults map 里已处理，此处跳过
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
