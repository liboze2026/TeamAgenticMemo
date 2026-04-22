import type { PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import {
  detectIgnoredSignals,
  detectBlockedCircumventedSignals,
  type OverrideSignalEvent,
} from "@teamagent/core";

export interface PostToolUseDeps {
  eventLog: {
    append(e: any): void;
    readLast(n: number): any[];
  };
}

export function createPostToolUseHandler(deps: PostToolUseDeps) {
  return async (input: PostToolUseHookInput): Promise<Record<string, never>> => {
    const tool_use_id = input.tool_use_id ?? crypto.randomUUID();
    const { tool_response } = input;
    const now = new Date().toISOString();
    const success = inferToolSuccess(tool_response);

    // 找本 tool_use_id 对应的 Pre 事件
    const recent = deps.eventLog.readLast(50);
    const preEvents = recent.filter(
      (e: any) => e.tool_use_id === tool_use_id && e.kind.startsWith("hook-pre."),
    );

    for (const pre of preEvents) {
      if (!pre.knowledge_id) continue;
      deps.eventLog.append({
        id: `e-post-${tool_use_id}-${pre.knowledge_id}`,
        kind: "hook-post.result",
        knowledge_id: pre.knowledge_id,
        tool_use_id,
        timestamp: now,
        schema_version: 1,
        payload: { success, source_pre_kind: pre.kind },
      });
    }

    // M2.5: detect ignored signals
    const ignoredList = detectIgnoredSignals(tool_use_id, recent as OverrideSignalEvent[]);
    for (const ig of ignoredList) {
      deps.eventLog.append({
        id: `e-override-ignored-${tool_use_id}-${ig.knowledge_id}`,
        kind: "ai.override.ignored",
        knowledge_id: ig.knowledge_id,
        tool_use_id,
        timestamp: now,
        schema_version: 1,
      });
    }

    // M3: detect block-circumvention — only when tool succeeded
    const toolName = (input as { tool_name?: string }).tool_name;
    if (success && toolName) {
      const circumList = detectBlockedCircumventedSignals(
        toolName,
        recent as OverrideSignalEvent[],
        new Date(now),
      );
      for (const c of circumList) {
        deps.eventLog.append({
          id: `e-override-circum-${tool_use_id}-${c.knowledge_id}`,
          kind: "ai.override.blocked_circumvented",
          knowledge_id: c.knowledge_id,
          tool_use_id,
          timestamp: now,
          schema_version: 1,
        });
      }
    }

    return {};
  };
}

export function inferToolSuccess(toolResponse: unknown): boolean {
  if (toolResponse === null || toolResponse === undefined) return true;
  if (typeof toolResponse !== "object") return true;
  const r = toolResponse as Record<string, unknown>;
  if (r.is_error === true) return false;
  if (r.error) return false;
  if (typeof r.exit_code === "number" && r.exit_code !== 0) return false;
  return true;
}
