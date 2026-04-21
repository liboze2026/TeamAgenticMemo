#!/usr/bin/env node
/**
 * Stop Hook entry point (M2.10+ with incremental scanning + dedup).
 *
 * stdin: StopHookInput { session_id, transcript_path, cwd, hook_event_name }
 *
 * Mode selection:
 *   - sync (legacy default): run analyze→calibrate→compile, write progress to stderr
 *   - async (recommended): spawn detached subprocess and return immediately
 *
 * Incremental vs full:
 *   - Stop hook: incremental (uses .teamagent/scan-cursor.json)
 *   - SessionEnd / PreCompact (via runStopPipeline({fullRescan:true})): full
 *
 * NEVER exits non-zero — must not block session close.
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ClaudeCodeLLMClient } from "@teamagent/adapters";
import type { LLMClient } from "@teamagent/ports";
import { momentSignature } from "@teamagent/core";
import { executeAnalyze, type AnalyzeMeta } from "./commands/analyze.js";
import { executeCalibrate } from "./commands/calibrate.js";
import { executeCompile } from "./commands/compile.js";
import { readTeamAgentConfig } from "./commands/config.js";
import { readCursor, writeCursor, clearCursor, readSeen, writeSeen } from "./scan-cursor.js";
import { appendHarvest } from "./harvest-writer.js";
import { makeFallbackLLMClient } from "./llm-with-fallback.js";

export interface StopHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}

export interface RunStopPipelineOptions {
  /** true → 忽略 cursor,扫整个 session (SessionEnd/PreCompact 用) */
  fullRescan?: boolean;
  /** 模式标签,仅用于 harvest md 记录 */
  modeTag?: "incremental" | "full";
}

/** Pipeline hard timeout. Harness kills us at its own timeout (~300s); we guard below. */
const PIPELINE_TIMEOUT_MS = (() => {
  const envVal = parseInt(process.env.TEAMAGENT_STOP_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 240_000;
})();

function isRetryableAnalyzeError(e: unknown): boolean {
  const msg = String(e);
  return (
    msg.includes("Session not found") ||
    msg.includes("permission denied") ||
    msg.includes("EACCES") ||
    msg.includes("EPERM") ||
    msg.includes("EBUSY")
  );
}

/** Lock file used by the statusline to show "Stop 运行中" indicator. */
const STOP_LOCK_RELATIVE = path.join(".teamagent", ".stop-running.lock");

function writeStopLock(cwd: string): string {
  const lockPath = path.join(cwd, STOP_LOCK_RELATIVE);
  try {
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }),
      "utf-8",
    );
  } catch {
    // lock is best-effort — statusline will simply not show the indicator
  }
  return lockPath;
}

function removeStopLock(lockPath: string): void {
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    // silent
  }
}

/** Build the Haiku-primary Sonnet-fallback LLM client. Overridable by env. */
function buildLLMClient(): LLMClient {
  const primaryModel = process.env.TEAMAGENT_LLM_MODEL ?? "haiku";
  const fallbackModel = process.env.TEAMAGENT_LLM_FALLBACK_MODEL ?? "sonnet";
  const primary = new ClaudeCodeLLMClient({ model: primaryModel });
  if (primaryModel === fallbackModel) return primary;
  const fallback = new ClaudeCodeLLMClient({ model: fallbackModel });
  return makeFallbackLLMClient(primary, fallback);
}

export async function runStopPipeline(
  input: StopHookInput,
  opts: RunStopPipelineOptions = {},
): Promise<void> {
  const cwd = input.cwd;
  const fullRescan = opts.fullRescan === true;
  const modeTag = opts.modeTag ?? (fullRescan ? "full" : "incremental");
  const lockPath = writeStopLock(cwd);
  try {

  // Load incremental state
  const sessionId = input.session_id;
  const fromTurnIndex = fullRescan ? undefined : (readCursor(cwd, sessionId) >= 0 ? readCursor(cwd, sessionId) : undefined);
  const seen = fullRescan ? new Set<string>() : readSeen(cwd, sessionId);
  const newlySeen = new Set<string>();

  let analyzeMeta: AnalyzeMeta | undefined;

  // Step 1: analyze. Claude Code can fire Stop before the transcript jsonl
  // finishes flushing to disk, or the file may still be locked on Windows
  // (EACCES/EPERM). Retry up to 4 times with back-off.
  try {
    process.stderr.write(`TeamAgent: 分析会话中 (${modeTag})...\n`);
    let lastErr: unknown;
    let analyzed = false;
    // Small initial wait: Claude Code may still hold the transcript file lock
    // when Stop fires on Windows.
    await new Promise((r) => setTimeout(r, 300));
    const llmClient = buildLLMClient();
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const result = await executeAnalyze({
          session: input.transcript_path,
          commit: true,
          cwd,
          fromTurnIndex,
          llmClient,
          isMomentSeen: (sig) => seen.has(sig),
          markMomentSeen: (sig) => { newlySeen.add(sig); seen.add(sig); },
          onMeta: (m) => { analyzeMeta = m; },
        });
        const firstLine = result.split("\n")[0] ?? "分析完成";
        process.stderr.write(`TeamAgent: ${firstLine}\n`);
        analyzed = true;
        break;
      } catch (e) {
        lastErr = e;
        if (!isRetryableAnalyzeError(e) || attempt === 4) break;
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
    if (!analyzed) throw lastErr;
  } catch (e) {
    logError(cwd, "analyze", e);
  }

  // Persist cursor + seen so next incremental Stop can skip
  if (analyzeMeta) {
    try {
      if (analyzeMeta.lastTurnIndex >= 0) {
        writeCursor(cwd, sessionId, analyzeMeta.lastTurnIndex);
      }
      if (newlySeen.size > 0 || seen.size > 0) {
        writeSeen(cwd, sessionId, seen);
      }
    } catch (e) {
      logError(cwd, "persist-cursor", e);
    }
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

  // Step 4: persist harvest markdown (always — even if meta missing, record that a run happened)
  try {
    appendHarvest(cwd, {
      sessionId,
      mode: modeTag,
      lastTurnIndex: analyzeMeta?.lastTurnIndex ?? -1,
      correctionsFound: analyzeMeta?.correctionsFound ?? 0,
      extracted: analyzeMeta?.extracted ?? 0,
      skipped: analyzeMeta?.skipped ?? 0,
      failed: analyzeMeta?.failed ?? 0,
      rejected: analyzeMeta?.rejected ?? 0,
      deduped: analyzeMeta?.deduped ?? 0,
      newEntries: analyzeMeta?.newEntries ?? [],
    });
  } catch (e) {
    logError(cwd, "harvest", e);
  }

  } finally {
    removeStopLock(lockPath);
  }
}

/** Public helper used by bin-session-end / bin-pre-compact to force full scan + clear cursor. */
export async function runFullRescanPipeline(input: StopHookInput): Promise<void> {
  await runStopPipeline(input, { fullRescan: true, modeTag: "full" });
  try {
    clearCursor(input.cwd, input.session_id);
  } catch (e) {
    logError(input.cwd, "clear-cursor", e);
  }
}

function logError(cwd: string, step: string, err: unknown): void {
  try {
    const logPath = path.join(os.homedir(), ".teamagent", "stop-errors.log");
    const stack = err instanceof Error && err.stack ? `\n  stack: ${err.stack.split("\n").slice(1, 3).join(" | ")}` : "";
    const msg = `[${new Date().toISOString()}] step=${step} cwd=${cwd} err=${String(err)}${stack}\n`;
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
      // CRITICAL on Windows: without this, every detached spawn opens a new
      // console window. In async mode that fires on every session close, so
      // users see a flurry of popups. Must hide.
      windowsHide: true,
    });
    child.unref();
    return;
  }

  // sync mode: wait with timeout
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
