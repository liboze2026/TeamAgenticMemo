#!/usr/bin/env node
/**
 * PreToolUse Hook 入口 (v2 — Claude Agent SDK 版)
 *
 * 读 stdin JSON → matchRules → createPreToolUseHandler → stdout JSON
 * 任何异常都退化为 exit 0（不阻断工作流）
 *
 * Matcher 策略（feature-flag via TEAMAGENT_MATCHER env var）：
 *   default / "semantic" : 先走 semanticMatch（XenovaRuleEmbedder + SqliteSemanticRetriever），
 *                          失败时自动降级到 legacy keyword matcher
 *   "legacy"             : 直接走 keyword matcher，不加载 embedder
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
  XenovaRuleEmbedder,
  SqliteSemanticRetriever,
} from "@teamagent/adapters";
import { matchRulesAsync, semanticMatch } from "@teamagent/core";
import type { KnowledgeEntry } from "@teamagent/types";

// ---- Lazy singletons for semantic path (per-process, reused if process is long-lived) ----
let _embedder: XenovaRuleEmbedder | null = null;
function getEmbedder(): XenovaRuleEmbedder {
  if (!_embedder) _embedder = new XenovaRuleEmbedder();
  return _embedder;
}

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

    const useLegacy = (process.env.TEAMAGENT_MATCHER ?? "").toLowerCase() === "legacy";

    let lastRuleCount = 0;
    const matcher = {
      match: async ({ tool_name, tool_input }: { tool_name: string; tool_input: unknown }) => {
        if (!useLegacy) {
          // --- Semantic path ---
          try {
            const actionText = `tool=${tool_name}\n${JSON.stringify(tool_input).slice(0, 500)}`;
            const contextText = actionText; // No AI message context in PreToolUse stdin

            const embedder = getEmbedder();

            // Query both DB layers (project=personal, global=global) and merge results
            const projectDb = openDb(projectDbPath);
            const globalDb = openDb(globalDbPath);
            const projectRetriever = new SqliteSemanticRetriever(projectDb);
            const globalRetriever = new SqliteSemanticRetriever(globalDb);

            let projectResults: import("@teamagent/core").SemanticMatch[];
            let globalResults: import("@teamagent/core").SemanticMatch[];
            try {
              [projectResults, globalResults] = await Promise.all([
                semanticMatch({
                  contextText,
                  actionText,
                  embedder,
                  retriever: projectRetriever,
                  scope: { level: "personal" },
                }),
                semanticMatch({
                  contextText,
                  actionText,
                  embedder,
                  retriever: globalRetriever,
                  scope: { level: "global" },
                }),
              ]);
            } finally {
              try { projectDb.close(); } catch { /* ok */ }
              try { globalDb.close(); } catch { /* ok */ }
            }

            // Merge and sort by score descending, dedup by rule id
            const seen = new Set<string>();
            const merged: KnowledgeEntry[] = [];
            for (const m of [...projectResults, ...globalResults].sort((a, b) => b.score - a.score)) {
              if (!seen.has(m.rule.id)) {
                seen.add(m.rule.id);
                merged.push(m.rule);
              }
            }

            lastRuleCount = merged.length;
            return { matched: merged };
          } catch (_semErr) {
            // Silent fallback to legacy on any semantic error
            process.stderr.write(`teamagent pre-hook: semantic match failed, falling back to legacy: ${String(_semErr)}\n`);
          }
        }

        // --- Legacy keyword path (default fallback or TEAMAGENT_MATCHER=legacy) ---
        const rules = store.findActive();
        lastRuleCount = rules.length;
        const result = await matchRulesAsync(
          { ...(typeof tool_input === "object" && tool_input !== null ? tool_input : {}), tool_name },
          rules,
          {},
        );
        return result;
      },
    };

    const rawVis = (process.env.TEAMAGENT_VISIBILITY ?? "verbose").toLowerCase();
    const visibility: "silent" | "smart" | "verbose" =
      rawVis === "silent" || rawVis === "smart" ? rawVis : "verbose";
    const handler = createPreToolUseHandler({
      matcher,
      eventLog,
      visibility,
      get ruleCount() { return lastRuleCount; },
    });
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
