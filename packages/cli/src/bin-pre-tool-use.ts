#!/usr/bin/env node
/**
 * PreToolUse Hook 入口 (v2 — Claude Agent SDK 版)
 *
 * 读 stdin JSON → matchRules → createPreToolUseHandler → stdout JSON
 * 任何异常都退化为 exit 0（不阻断工作流）
 */
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  normalizeCwd,
  createPreToolUseHandler,
  DualLayerStore,
  SqliteEventLog,
  openDb,
} from "@teamagent/adapters";
import { matchRulesAsync } from "@teamagent/core";

async function readStdinJson(): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function main(): Promise<void> {
  let input: any;
  try {
    input = await readStdinJson();
  } catch (err) {
    process.stderr.write(`teamagent pre-hook: stdin read/parse failed: ${String(err)}\n`);
    process.exit(0);
  }

  if (!input) {
    process.exit(0);
  }

  try {
    const cwd = normalizeCwd(input.cwd ?? process.cwd());
    const home = os.homedir();

    const projectDbPath = path.join(cwd, ".teamagent", "knowledge.db");
    const globalDbPath = path.join(home, ".teamagent", "global.db");
    const eventsDbPath = path.join(home, ".teamagent", "events.db");

    fs.mkdirSync(path.dirname(projectDbPath), { recursive: true });
    fs.mkdirSync(path.dirname(globalDbPath), { recursive: true });
    fs.mkdirSync(path.dirname(eventsDbPath), { recursive: true });

    const store = new DualLayerStore({ projectDbPath, userGlobalDbPath: globalDbPath });
    const eventLog = new SqliteEventLog(openDb(eventsDbPath));

    const matcher = {
      match: async ({ tool_name, tool_input }: { tool_name: string; tool_input: unknown }) => {
        const rules = store.findActive();
        const result = await matchRulesAsync(
          { ...(typeof tool_input === "object" && tool_input !== null ? tool_input : {}), tool_name },
          rules,
          {},
        );
        return result;
      },
    };

    const handler = createPreToolUseHandler({ matcher, eventLog });
    const result = await handler(input);

    store.close();
    eventLog.close();

    // Wrap in hookSpecificOutput envelope so both the Claude Code CLI and
    // the @anthropic-ai/claude-agent-sdk query() respect the decision.
    // Without the wrapper, the SDK ignores the flat { permissionDecision }
    // shape and tool calls execute even when the handler returned "deny".
    const wrapped: Record<string, unknown> = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: result.permissionDecision,
        ...(result.permissionDecisionReason
          ? { permissionDecisionReason: result.permissionDecisionReason }
          : {}),
      },
      ...(result.systemMessage ? { systemMessage: result.systemMessage } : {}),
    };

    process.stdout.write(JSON.stringify(wrapped));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`teamagent pre-hook: handler error: ${String(err)}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  process.stderr.write(`teamagent pre-hook: unexpected: ${String(err)}\n`);
  process.exit(0);
});
