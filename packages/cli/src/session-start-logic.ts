/**
 * SessionStart logic. No top-level side effects — safe to import from tests.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { loadWikiConfig } from "@teamagent/adapters/wiki/config-loader";
import { LastPullMarker } from "@teamagent/adapters/wiki/last-pull-marker";

export const DEFAULT_DEBOUNCE_HOURS = 24;

export type Action =
  | "spawn"
  | "skip-debounced"
  | "skip-no-db"
  | "skip-disabled"
  | "auto-init"
  | "skip-not-a-project"
  | "skip-auto-init-disabled";

/** Project markers — cwd must have at least one of these to trigger auto-init. */
const PROJECT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "pnpm-workspace.yaml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
];

function isProjectDir(cwd: string): boolean {
  for (const m of PROJECT_MARKERS) {
    if (existsSync(join(cwd, m))) return true;
  }
  return false;
}

function autoInitDisabled(cwd: string): boolean {
  // User can opt out per-project OR globally
  return (
    existsSync(join(cwd, ".teamagent", "auto-init.disabled")) ||
    existsSync(join(os.homedir(), ".teamagent", "auto-init.disabled"))
  );
}

export function decideAction(cwd: string, now: Date, debounceHours?: number): Action {
  const dbPath = join(cwd, ".teamagent", "knowledge.db");
  if (!existsSync(dbPath)) {
    // New project (no DB yet). Auto-init if it looks like a real project
    // and user hasn't opted out.
    if (autoInitDisabled(cwd)) return "skip-auto-init-disabled";
    if (!isProjectDir(cwd)) return "skip-not-a-project";
    return "auto-init";
  }
  const cfg = loadWikiConfig(cwd);
  if (!cfg.autoRefresh.enabled) return "skip-disabled";
  const hours = debounceHours ?? cfg.autoRefresh.debounceHours;
  const marker = new LastPullMarker(join(cwd, ".teamagent"));
  return marker.shouldSkip(now, hours) ? "skip-debounced" : "spawn";
}

export function findMainBin(): string {
  // bin-session-start.cjs sits next to bin.js in dist/
  return join(__dirname, "bin.js");
}

/**
 * Spawn `teamagent init --skip-import --skip-hook=false` asynchronously.
 * Detached so SessionStart hook itself returns fast.
 * Result shown via stderr on next interactive turn; subprocess writes its own
 * progress to a log file under ~/.teamagent/auto-init.log.
 */
export function spawnAutoInit(cwd: string): void {
  const logPath = join(os.homedir(), ".teamagent", "auto-init.log");
  try {
    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] auto-init spawn cwd=${cwd}\n`,
      "utf-8",
    );
  } catch { /* silent */ }
  const child = spawn(
    process.execPath,
    [findMainBin(), "init", "--skip-import"],
    {
      detached: true,
      stdio: "ignore",
      cwd,
      env: { ...process.env, TEAMAGENT_AUTO_INIT: "1" },
      windowsHide: true,
    },
  );
  child.unref();
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
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: cwd,
      TEAMAGENT_WIKI_TRIGGER: "session-start",
    },
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
