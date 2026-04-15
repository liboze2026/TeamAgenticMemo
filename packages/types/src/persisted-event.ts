/**
 * 持久化到 ~/.teamagent/events.jsonl 的事件 schema。
 *
 * **重要**: 此 schema 在 M2 一次定完，M6 (PostToolUse + Calibrator)
 * 直接复用，不修改字段。新增字段必须保持向后兼容（可选项）。
 *
 * 用途：
 * - Hook 短进程产生事件 → 落盘
 * - stats / Portal 长进程消费事件 → 聚合
 * - Calibrator (M6) 通过 intervention_id 关联 Pre/Post 算 confidence delta
 */
export interface PersistedEvent {
  /** 事件唯一 id（uuid 或 timestamp+rand） */
  id: string;
  /** 干预 id；PreToolUse 命中时生成，PostToolUse 关联回来 */
  intervention_id?: string;
  /** 事件类型 */
  kind:
    | "hook-pre.matched"
    | "hook-pre.blocked"
    | "hook-pre.warned"
    | "hook-post.result"
    | "pitfall.added"
    | "compiler.updated"
    | "extractor.extracted"
    | "calibrator.adjusted"
    | "init.completed"
    | "scenario.run";
  /** Claude Code 会话 id（从 hook input 拿到） */
  session_id?: string;
  /** 涉及的知识条目 id（如 hook 命中某条规则） */
  knowledge_id?: string;
  /** Claude Code 内部 tool 调用 id；PreToolUse 和 PostToolUse 配对用 */
  tool_use_id?: string;
  /** 工具调用快照（PreToolUse / PostToolUse 用） */
  tool?: {
    name: string;
    input: Record<string, unknown>;
  };
  /** 工具执行结果（PostToolUse 用） */
  result?: {
    succeeded: boolean;
    stderr?: string;
    exit_code?: number;
  };
  /** 当前工作目录 */
  cwd?: string;
  /** ISO 8601 */
  timestamp: string;
  /** schema 版本，写死 1。新字段必须保持向后兼容（增 optional） */
  schema_version: 1;
}
