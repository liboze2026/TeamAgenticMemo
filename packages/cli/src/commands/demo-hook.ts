import os from "node:os";
import path from "node:path";
import { handlePreToolUse } from "@teamagent/adapters";
import type { PreToolUseInput } from "@teamagent/types";

export interface DemoHookOptions {
  toolName: string;
  toolInput: Record<string, unknown>;
  cwd?: string;
  homeDir?: string;
  now?: () => string;
}

/**
 * 离线模拟一次 PreToolUse hook。
 * 用真实的知识库（personal/team/global）做匹配，但不需要 Claude Code。
 *
 * 返回归因式 stdout 文本（人类可读），而不是 hook JSON——便于命令行查看。
 */
export function executeDemoHook(opts: DemoHookOptions): string {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.homeDir ?? os.homedir();
  const now = opts.now ?? (() => new Date().toISOString());

  const fakeInput: PreToolUseInput = {
    session_id: "demo-session",
    hook_event_name: "PreToolUse",
    cwd,
    permission_mode: "default",
    transcript_path: path.join(home, ".teamagent", "demo-transcript.jsonl"),
    tool_name: opts.toolName,
    tool_input: opts.toolInput,
    tool_use_id: "demo-tool-call",
  };

  const output = handlePreToolUse(fakeInput, { cwd, homeDir: home, now });

  if (Object.keys(output).length === 0) {
    return [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "🟢 TeamAgent · 模拟 PreToolUse 结果",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `▸ 工具: ${opts.toolName}`,
      `▸ 输入: ${JSON.stringify(opts.toolInput)}`,
      "▸ 决策: 通过 (无规则命中)",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
    ].join("\n");
  }

  const decision = output.hookSpecificOutput?.permissionDecision ?? "allow";
  const icon = decision === "deny" ? "🚫" : decision === "ask" ? "❓" : "💡";
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `${icon} TeamAgent · 模拟 PreToolUse 结果`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `▸ 工具: ${opts.toolName}`,
    `▸ 输入: ${JSON.stringify(opts.toolInput)}`,
    `▸ 决策: ${decision}`,
  ];

  if (output.hookSpecificOutput?.permissionDecisionReason) {
    lines.push("▸ 拦截原因:");
    for (const ln of output.hookSpecificOutput.permissionDecisionReason.split("\n")) {
      lines.push(`    ${ln}`);
    }
  }
  if (output.systemMessage) {
    lines.push("▸ 给 AI 的提示:");
    for (const ln of output.systemMessage.split("\n")) {
      lines.push(`    ${ln}`);
    }
  }
  if (output.hookSpecificOutput?.additionalContext) {
    lines.push(`▸ 附加上下文: ${output.hookSpecificOutput.additionalContext}`);
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  return lines.join("\n");
}

/** 解析 demo-hook 的 CLI 参数：argv[0]=tool, argv[1..]=key=value */
export function parseDemoHookArgs(args: string[]): DemoHookOptions | null {
  if (args.length === 0) return null;
  const toolName = args[0]!;
  const toolInput: Record<string, unknown> = {};

  for (const a of args.slice(1)) {
    const idx = a.indexOf("=");
    if (idx < 0) continue;
    const k = a.slice(0, idx);
    const v = a.slice(idx + 1);
    // 尝试解析 JSON，否则保留为字符串
    try {
      toolInput[k] = JSON.parse(v);
    } catch {
      toolInput[k] = v;
    }
  }

  return { toolName, toolInput };
}
