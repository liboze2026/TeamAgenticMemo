import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

function filePath(sessionsDir: string, sessionId: string): string {
  return path.join(sessionsDir, `${sessionId}_session_injected.json`);
}

export function readSessionInjected(sessionsDir: string, sessionId: string): Set<string> {
  const fp = filePath(sessionsDir, sessionId);
  if (!existsSync(fp)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(fp, "utf-8"));
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

export function isFirstPrompt(sessionsDir: string, sessionId: string): boolean {
  return !existsSync(filePath(sessionsDir, sessionId));
}

export function appendSessionInjected(
  sessionsDir: string,
  sessionId: string,
  ids: string[],
): void {
  if (ids.length === 0) return;
  const fp = filePath(sessionsDir, sessionId);
  const existing = readSessionInjected(sessionsDir, sessionId);
  for (const id of ids) existing.add(id);
  try {
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(fp, JSON.stringify([...existing]));
  } catch {
    // best-effort
  }
}
