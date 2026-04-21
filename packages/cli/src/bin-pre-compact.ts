#!/usr/bin/env node
/**
 * PreCompact Hook entry point.
 *
 * Fires when Claude Code is about to compact the transcript. Performs a full
 * rescan BEFORE compaction so learnings from the soon-to-be-summarized turns
 * are captured in the knowledge base.
 *
 * Always async detached. Must not block compaction UX. Must not pop windows.
 * NEVER exits non-zero.
 */
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runFullRescanPipeline, type StopHookInput } from "./bin-stop.js";

async function main(): Promise<void> {
  if (process.env["TEAMAGENT_PRE_COMPACT_PIPELINE"] === "1") {
    const input = JSON.parse(process.argv[2] ?? "{}") as StopHookInput;
    await runFullRescanPipeline(input);
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return;

  const input = JSON.parse(raw) as StopHookInput;
  const cwd = input.cwd ?? process.cwd();

  const selfPath = process.argv[1]!;
  const child = spawn(process.execPath, [selfPath, JSON.stringify(input)], {
    detached: true,
    stdio: "ignore",
    cwd,
    env: { ...process.env, TEAMAGENT_PRE_COMPACT_PIPELINE: "1" },
    windowsHide: true,
  });
  child.unref();
}

main().catch((e) => {
  try {
    const logPath = path.join(os.homedir(), ".teamagent", "stop-errors.log");
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] pre-compact-crash err=${String(e)}\n`,
      "utf-8",
    );
  } catch { /* silent */ }
  process.exit(0);
});
