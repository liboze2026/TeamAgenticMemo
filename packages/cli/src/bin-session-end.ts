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
import { appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runFullRescanPipeline, type StopHookInput } from "./bin-stop.js";

const FULL_RESCAN_TIMEOUT_MS = (() => {
  const envVal = parseInt(process.env.TEAMAGENT_STOP_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 240_000;
})();

async function main(): Promise<void> {
  // Spawned as detached subprocess
  if (process.env["TEAMAGENT_SESSION_END_PIPELINE"] === "1") {
    const input = JSON.parse(process.argv[2] ?? "{}") as StopHookInput;
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

  // Detached + windowsHide — MUST NOT pop a console window on Windows.
  const selfPath = process.argv[1]!;
  const child = spawn(process.execPath, [selfPath, JSON.stringify(input)], {
    detached: true,
    stdio: "ignore",
    cwd,
    env: { ...process.env, TEAMAGENT_SESSION_END_PIPELINE: "1" },
    windowsHide: true,
  });
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
