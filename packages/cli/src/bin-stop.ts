#!/usr/bin/env node
/**
 * Stop Hook entry point (M2.10)
 *
 * stdin: StopHookInput { session_id, transcript_path, cwd, hook_event_name }
 * sync mode (default): run analyze→calibrate→compile, write progress to stderr
 * async mode: spawn detached subprocess and return immediately
 *
 * NEVER exits non-zero — must not block session close.
 */
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeAnalyze } from "./commands/analyze.js";
import { executeCalibrate } from "./commands/calibrate.js";
import { executeCompile } from "./commands/compile.js";
import { readTeamAgentConfig } from "./commands/config.js";

export interface StopHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}

const PIPELINE_TIMEOUT_MS = 55_000;

export async function runStopPipeline(input: StopHookInput): Promise<void> {
  const cwd = input.cwd;

  // Step 1: analyze. Claude Code can fire Stop before the transcript jsonl
  // finishes flushing to disk → "Session not found". Retry a few times so the
  // pipeline survives the race.
  try {
    process.stderr.write("TeamAgent: 分析会话中...\n");
    let lastErr: unknown;
    let analyzed = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const result = await executeAnalyze({
          session: input.transcript_path,
          commit: true,
          cwd,
        });
        const firstLine = result.split("\n")[0] ?? "分析完成";
        process.stderr.write(`TeamAgent: ${firstLine}\n`);
        analyzed = true;
        break;
      } catch (e) {
        lastErr = e;
        if (!String(e).includes("Session not found") || attempt === 4) break;
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
    if (!analyzed) throw lastErr;
  } catch (e) {
    logError(cwd, "analyze", e);
  }

  // Step 2: calibrate
  try {
    process.stderr.write("TeamAgent: 校准置信度中...\n");
    await executeCalibrate({ cwd });
    process.stderr.write("TeamAgent: 校准完成\n");
  } catch (e) {
    logError(cwd, "calibrate", e);
  }

  // Step 3: compile
  try {
    process.stderr.write("TeamAgent: 编译 CLAUDE.md 中...\n");
    const r = await executeCompile({ cwd });
    process.stderr.write(
      `TeamAgent: CLAUDE.md 已更新，Skills 导出 ${r.skills.written.length} 条\n`,
    );
    try {
      const { getRecentEntries } = await import("./commands/recent-entries.js");
      const recent = await getRecentEntries(cwd);
      if (recent.length > 0) {
        process.stdout.write(`✦ TeamAgent 本会话学到 ${recent.length} 条新经验\n`);
        for (const e of recent) {
          process.stdout.write(`  · ${e.tldr} [${e.confidence.toFixed(2)}]\n`);
        }
      }
    } catch {
      // summary failure must not affect main flow
    }
  } catch (e) {
    logError(cwd, "compile", e);
  }
}

function logError(cwd: string, step: string, err: unknown): void {
  try {
    const logPath = path.join(os.homedir(), ".teamagent", "stop-errors.log");
    const msg = `[${new Date().toISOString()}] step=${step} cwd=${cwd} err=${String(err)}\n`;
    appendFileSync(logPath, msg, "utf-8");
  } catch {
    // log write failure must not propagate
  }
}

async function main(): Promise<void> {
  // When spawned as detached pipeline subprocess
  if (process.env["TEAMAGENT_STOP_PIPELINE"] === "1") {
    const input = JSON.parse(process.argv[2] ?? "{}") as StopHookInput;
    await runStopPipeline(input);
    return;
  }

  // Normal Stop hook entry: read from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return;

  const input = JSON.parse(raw) as StopHookInput;
  const cwd = input.cwd ?? process.cwd();
  const config = readTeamAgentConfig(cwd);

  if (config.stop_mode === "async") {
    const selfPath = process.argv[1]!;
    const child = spawn(process.execPath, [selfPath, JSON.stringify(input)], {
      detached: true,
      stdio: "ignore",
      cwd,
      env: { ...process.env, TEAMAGENT_STOP_PIPELINE: "1" },
    });
    child.unref();
    return;
  }

  // sync mode (default): wait with timeout
  await Promise.race([
    runStopPipeline(input),
    new Promise<void>((resolve) => setTimeout(resolve, PIPELINE_TIMEOUT_MS)),
  ]);
}

main().catch((e) => {
  try {
    const logPath = path.join(os.homedir(), ".teamagent", "stop-errors.log");
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] main-crash err=${String(e)}\n`,
      "utf-8",
    );
  } catch { /* silent */ }
  process.exit(0); // never block session close
});
