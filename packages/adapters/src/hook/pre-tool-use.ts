import os from "node:os";
import path from "node:path";
import { matchRules } from "@teamagent/core";
import type {
  HookOutput,
  KnowledgeEntry,
  PersistedEvent,
  PreToolUseInput,
} from "@teamagent/types";
import { JsonlKnowledgeStore } from "../storage/jsonl-store.js";
import { JsonlEventLog } from "../events/jsonl-event-log.js";

export interface PreToolUseOptions {
  personalPath?: string;
  teamPath?: string;
  globalPath?: string;
  eventsPath?: string;
  cwd?: string;
  homeDir?: string;
  now?: () => string;
}

/**
 * Windows + Git Bash 路径规范化：把 `/c/bzli/...` 转成 `C:/bzli/...`。
 * Claude Code 在 Windows 下传给 hook 的 cwd 是 Git Bash 风格（`/c/...`），
 * 但 Node on Windows 的 path/fs API 会把它当成根目录下的 `c` 文件夹。
 */
function normalizeCwd(p: string): string {
  const m = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) return `${m[1]!.toUpperCase()}:/${m[2]}`;
  return p;
}

function resolvePaths(opts: PreToolUseOptions, ctxCwd: string) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = normalizeCwd(opts.cwd ?? ctxCwd);
  return {
    personalPath:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    teamPath: opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    globalPath:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    eventsPath: opts.eventsPath ?? path.join(home, ".teamagent", "events.jsonl"),
  };
}

function loadAllRules(paths: ReturnType<typeof resolvePaths>): KnowledgeEntry[] {
  const all: KnowledgeEntry[] = [];
  for (const p of [paths.personalPath, paths.teamPath, paths.globalPath]) {
    try {
      all.push(...new JsonlKnowledgeStore(p).getActive());
    } catch {
      // 单个 store 损坏不应影响其他 store
    }
  }
  return all;
}

function makeId(prefix: string, now: string): string {
  const ts = now.replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * 核心逻辑：根据规则集决定 hook 输出 + 落盘事件。
 *
 * 设计：永不抛错——任何内部异常都退化为"通过"（空输出），
 * 不阻断用户工作流。错误情况会尝试落盘到 events.jsonl 留痕。
 */
export function handlePreToolUse(
  input: PreToolUseInput,
  opts: PreToolUseOptions = {},
): HookOutput {
  try {
    const now = (opts.now ?? (() => new Date().toISOString()))();
    const paths = resolvePaths(opts, input.cwd);

    const rules = loadAllRules(paths);
    const matches = matchRules(
      { toolName: input.tool_name, input: input.tool_input },
      rules,
    );

    if (matches.length === 0) {
      return {};
    }

    const eventLog = new JsonlEventLog(paths.eventsPath);
    const interventionId = makeId("iv", now);

    // 对每个命中规则都记一条 matched 事件
    for (const rule of matches) {
      const evt: PersistedEvent = {
        id: makeId("evt", now),
        intervention_id: interventionId,
        kind: "hook-pre.matched",
        session_id: input.session_id,
        knowledge_id: rule.id,
        tool: { name: input.tool_name, input: input.tool_input },
        cwd: input.cwd,
        timestamp: now,
        schema_version: 1,
      };
      try {
        eventLog.append(evt);
      } catch {
        // 落盘失败不影响返回
      }
    }

    // 取最高 enforcement 的规则做决策（matches 已按 enforcement 降序）
    const top = matches[0]!;

    if (top.enforcement === "block") {
      // 额外记一条 blocked 决策事件
      try {
        eventLog.append({
          id: makeId("evt", now),
          intervention_id: interventionId,
          kind: "hook-pre.blocked",
          session_id: input.session_id,
          knowledge_id: top.id,
          tool: { name: input.tool_name, input: input.tool_input },
          cwd: input.cwd,
          timestamp: now,
          schema_version: 1,
        });
      } catch {}

      const reason = formatBlockReason(top);
      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      };
    }

    if (top.enforcement === "warn") {
      try {
        eventLog.append({
          id: makeId("evt", now),
          intervention_id: interventionId,
          kind: "hook-pre.warned",
          session_id: input.session_id,
          knowledge_id: top.id,
          tool: { name: input.tool_name, input: input.tool_input },
          cwd: input.cwd,
          timestamp: now,
          schema_version: 1,
        });
      } catch {}

      const msg = formatWarnMessage(top);
      return {
        continue: true,
        systemMessage: msg,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          additionalContext: top.correct_pattern,
        },
      };
    }

    // suggest / passive 默认通过，不打扰
    return {};
  } catch {
    // 防御性：任何意外异常都不阻断用户
    return {};
  }
}

function formatBlockReason(rule: KnowledgeEntry): string {
  return [
    `🚫 TeamAgent 拦截 (置信 ${rule.confidence.toFixed(2)})`,
    `应改用: ${rule.correct_pattern}`,
    `原因: ${rule.reasoning}`,
    `(规则 id: ${rule.id})`,
  ].join("\n");
}

function formatWarnMessage(rule: KnowledgeEntry): string {
  return [
    `💡 TeamAgent 经验 (置信 ${rule.confidence.toFixed(2)})`,
    `推荐: ${rule.correct_pattern}`,
    `原因: ${rule.reasoning}`,
  ].join("\n");
}
