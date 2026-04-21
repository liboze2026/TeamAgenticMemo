#!/usr/bin/env node
/**
 * SessionStart Hook entry. NEVER blocks UI. NEVER exits non-zero.
 */
import { decideAction, spawnRefresh, logError, DEFAULT_DEBOUNCE_HOURS } from "./session-start-logic.js";

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let cwd = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  if (raw) {
    try {
      const input = JSON.parse(raw) as { cwd?: string };
      if (input.cwd) cwd = input.cwd;
    } catch { /* fallback to env/cwd */ }
  }

  const action = decideAction(cwd, new Date());
  if (action === "spawn") {
    try { spawnRefresh(cwd); } catch (e) { logError("spawn-failed", e); }
  }
}

main().catch((e) => { logError("main-crash", e); process.exit(0); });
