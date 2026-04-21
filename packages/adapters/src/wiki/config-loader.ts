import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface WikiConfig {
  autoRefresh: { enabled: boolean; debounceHours: number };
  sweep: { enabled: boolean; zeroHitMinAgeDays: number; perSourceKeep: number };
}

export const DEFAULT_WIKI_CONFIG: WikiConfig = {
  autoRefresh: { enabled: true, debounceHours: 24 },
  sweep: { enabled: true, zeroHitMinAgeDays: 60, perSourceKeep: 3 },
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function loadWikiConfig(cwd: string): WikiConfig {
  try {
    const raw = readFileSync(join(cwd, ".teamagent", "config.json"), "utf-8");
    const obj = JSON.parse(raw) as {
      wiki?: {
        autoRefresh?: Record<string, unknown>;
        sweep?: Record<string, unknown>;
      };
    };
    const ar = obj.wiki?.autoRefresh ?? {};
    const sw = obj.wiki?.sweep ?? {};
    return {
      autoRefresh: {
        enabled: bool(ar.enabled, DEFAULT_WIKI_CONFIG.autoRefresh.enabled),
        debounceHours: num(ar.debounceHours, DEFAULT_WIKI_CONFIG.autoRefresh.debounceHours),
      },
      sweep: {
        enabled: bool(sw.enabled, DEFAULT_WIKI_CONFIG.sweep.enabled),
        zeroHitMinAgeDays: num(sw.zeroHitMinAgeDays, DEFAULT_WIKI_CONFIG.sweep.zeroHitMinAgeDays),
        perSourceKeep: num(sw.perSourceKeep, DEFAULT_WIKI_CONFIG.sweep.perSourceKeep),
      },
    };
  } catch {
    return DEFAULT_WIKI_CONFIG;
  }
}
