#!/usr/bin/env node
/**
 * SessionEnd Hook entry point.
 *
 * Fires on /clear, logout, Ctrl+C at prompt, window close. Performs a full
 * rescan of the transcript (ignoring scan-cursor) and clears that session's
 * cursor so the next session starts fresh.
 *
 * Always runs in async detached mode — never blocks the UI close.
 * NEVER exits non-zero.
 */
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDetachedPipelineInvocation, runFullRescanPipeline, type StopHookInput } from "./bin-stop.js";

const FULL_RESCAN_TIMEOUT_MS = (() => {
  const envVal = parseInt(process.env.TEAMAGENT_STOP_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 240_000;
})();

async function main(): Promise<void> {
  // B-068: only enter detached branch when env flag AND argv[2] tmp file
  // both prove this is a real child. Otherwise the env was leaked from a
  // prior process and we must fall through to the foreground stdin path.
  if (isDetachedPipelineInvocation(process.env, process.argv, "TEAMAGENT_SESSION_END_PIPELINE")) {
    const arg = process.argv[2]!;
    const raw = readFileSync(arg, "utf-8");
    try { unlinkSync(arg); } catch { /* ignore */ }
    const input = JSON.parse(raw) as StopHookInput;
    await runFullRescanPipeline(input);
    return;
  }

  // Hook entry: read stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return;

  const input = JSON.parse(raw) as StopHookInput;
  const cwd = input.cwd ?? process.cwd();

  // Use temp file to pass JSON payload — avoids Windows command-line quoting issues.
  const selfPath = process.argv[1]!;
  const tmpFile = path.join(os.tmpdir(), `teamagent-session-end-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(tmpFile, JSON.stringify(input), "utf-8");

  const child = spawn(process.execPath, [selfPath, tmpFile], {
    detached: true,
    stdio: "ignore",
    cwd,
    env: { ...process.env, TEAMAGENT_SESSION_END_PIPELINE: "1" },
    windowsHide: true,
  });
  child.on("error", () => { try { unlinkSync(tmpFile); } catch { /* ignore */ } });
  child.unref();
}

main().catch((e) => {
  try {
    const logPath = path.join(os.homedir(), ".teamagent", "stop-errors.log");
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] session-end-crash err=${String(e)}\n`,
      "utf-8",
    );
  } catch { /* silent */ }
  process.exit(0);
});

// Silence unused-var warning for timeout constant (reserved for future sync fallback)
void FULL_RESCAN_TIMEOUT_MS;
