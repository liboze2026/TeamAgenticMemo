/**
 * SessionStart logic. No top-level side effects — safe to import from tests.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { LastPullMarker, loadWikiConfig } from "@teamagent/adapters";

export const DEFAULT_DEBOUNCE_HOURS = 24;

export type Action = "spawn" | "skip-debounced" | "skip-no-db" | "skip-disabled";

export function decideAction(cwd: string, now: Date, debounceHours?: number): Action {
  const dbPath = join(cwd, ".teamagent", "knowledge.db");
  if (!existsSync(dbPath)) return "skip-no-db";
  const cfg = loadWikiConfig(cwd);
  if (!cfg.autoRefresh.enabled) return "skip-disabled";
  const hours = debounceHours ?? cfg.autoRefresh.debounceHours;
  const marker = new LastPullMarker(join(cwd, ".teamagent"));
  return marker.shouldSkip(now, hours) ? "skip-debounced" : "spawn";
}

export function findRefreshBin(): string {
  // Hook runs from CC's %TEMP% dir; sibling bin-wiki-refresh.cjs lives next to this bundled file.
  return join(__dirname, "bin-wiki-refresh.cjs");
}

export function spawnRefresh(cwd: string): void {
  const child = spawn(process.execPath, [findRefreshBin()], {
    detached: true,
    stdio: "ignore",
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    windowsHide: true,
  });
  child.unref();
}

export function logError(kind: string, err: unknown): void {
  try {
    const logPath = join(os.homedir(), ".teamagent", "wiki-refresh-errors.log");
    appendFileSync(logPath, `[${new Date().toISOString()}] session-start:${kind} ${String(err)}\n`, "utf-8");
  } catch { /* silent */ }
}
