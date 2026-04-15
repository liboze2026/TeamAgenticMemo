import os from "node:os";
import path from "node:path";
import type {
  HookOutput,
  PersistedEvent,
  PostToolUseInput,
} from "@teamagent/types";
import { JsonlEventLog } from "../events/jsonl-event-log.js";

export interface PostToolUseOptions {
  eventsPath?: string;
  cwd?: string;
  homeDir?: string;
  now?: () => string;
}

/** Windows + Git Bash 路径规范化。复用 PreToolUse 同样的语义。 */
function normalizeCwd(p: string): string {
  const m = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) return `${m[1]!.toUpperCase()}:/${m[2]}`;
  return p;
}

function resolvePaths(opts: PostToolUseOptions, ctxCwd: string) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = normalizeCwd(opts.cwd ?? ctxCwd);
  return {
    eventsPath: opts.eventsPath ?? path.join(home, ".teamagent", "events.jsonl"),
    cwd,
  };
}

function makeId(prefix: string, now: string): string {
  const ts = now.replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * 解析 PostToolUse 的 tool_response 决定本次 tool 是否成功。
 *
 * Claude Code 的 tool_response 没有标准化的"是否成功"字段。各 tool 不同：
 * - Bash: 通常含 `interrupted` / `is_error` / `stdout` / `stderr` / `exit_code`
 * - Edit/Write: 失败时含 `error` 或 `is_error: true`
 * - 通用兜底：看 `is_error` / `error` / `exit_code`
 *
 * 启发式：
 * - is_error=true → 失败
 * - error 字段非空 → 失败
 * - exit_code 是数字且非 0 → 失败
 * - 都不满足 → 成功
 */
export function inferToolSuccess(
  toolResponse: Record<string, unknown>,
): { succeeded: boolean; exit_code?: number; stderr?: string } {
  const isError = toolResponse.is_error;
  if (isError === true) {
    return {
      succeeded: false,
      ...(typeof toolResponse.stderr === "string"
        ? { stderr: toolResponse.stderr }
        : {}),
    };
  }
  const errorField = toolResponse.error;
  if (typeof errorField === "string" && errorField.trim().length > 0) {
    return { succeeded: false, stderr: errorField };
  }
  const exitCode = toolResponse.exit_code;
  if (typeof exitCode === "number" && exitCode !== 0) {
    return {
      succeeded: false,
      exit_code: exitCode,
      ...(typeof toolResponse.stderr === "string"
        ? { stderr: toolResponse.stderr }
        : {}),
    };
  }
  // 默认成功
  return {
    succeeded: true,
    ...(typeof exitCode === "number" ? { exit_code: exitCode } : {}),
  };
}

/**
 * PostToolUse Hook 主入口。
 *
 * 行为：
 * 1. 从 events.jsonl 找匹配的 PreToolUse 事件（同 tool_use_id）
 * 2. 把 intervention_id + knowledge_id 串接起来
 * 3. 写一条 hook-post.result 事件
 * 4. 输出空 — PostToolUse 不需要给 AI 反馈
 *
 * 关键设计决策：永不抛错，任何异常都退化为空输出，不阻断用户。
 */
export function handlePostToolUse(
  input: PostToolUseInput,
  opts: PostToolUseOptions = {},
): HookOutput {
  try {
    const now = (opts.now ?? (() => new Date().toISOString()))();
    const paths = resolvePaths(opts, input.cwd);

    const result = inferToolSuccess(input.tool_response);

    // 找出此 tool_use_id 对应的 pre 事件（可能 0 条，可能多条）
    const eventLog = new JsonlEventLog(paths.eventsPath);
    let allEvents: PersistedEvent[] = [];
    try {
      allEvents = eventLog.readAll();
    } catch {
      // 文件不存在或损坏 → 退化为"无关联"
    }

    const preEvents = allEvents.filter(
      (e) =>
        e.tool_use_id === input.tool_use_id &&
        (e.kind === "hook-pre.matched" ||
          e.kind === "hook-pre.warned" ||
          e.kind === "hook-pre.blocked"),
    );

    if (preEvents.length === 0) {
      // 无 pre 关联 — 工具未被任何规则命中。仍然写一条 result 以备日后用
      try {
        eventLog.append({
          id: makeId("evt", now),
          kind: "hook-post.result",
          session_id: input.session_id,
          tool_use_id: input.tool_use_id,
          tool: { name: input.tool_name, input: input.tool_input },
          result,
          cwd: input.cwd,
          timestamp: now,
          schema_version: 1,
        });
      } catch {}
      return {};
    }

    // 取第一条 pre 事件的 intervention_id（同 tool_use_id 的事件应共享）
    const interventionId = preEvents[0]!.intervention_id;

    // 对每个被命中的 knowledge_id 各写一条 result（calibrator 按 knowledge_id 聚合）
    const knowledgeIds = new Set(
      preEvents
        .map((e) => e.knowledge_id)
        .filter((id): id is string => typeof id === "string"),
    );

    for (const kid of knowledgeIds) {
      try {
        eventLog.append({
          id: makeId("evt", now),
          ...(interventionId ? { intervention_id: interventionId } : {}),
          kind: "hook-post.result",
          session_id: input.session_id,
          knowledge_id: kid,
          tool_use_id: input.tool_use_id,
          tool: { name: input.tool_name, input: input.tool_input },
          result,
          cwd: input.cwd,
          timestamp: now,
          schema_version: 1,
        });
      } catch {
        // 单条写失败不影响其他
      }
    }

    return {};
  } catch {
    return {};
  }
}
