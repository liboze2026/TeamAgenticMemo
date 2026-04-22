/**
 * Append-only wiki harvest log. Records every wiki pull into
 * .teamagent/last-wiki-pull.md so the user can see what external news
 * was pulled even when the refresh runs detached at SessionStart.
 */
import fs from "node:fs";
import path from "node:path";

export const WIKI_HARVEST_FILE_RELATIVE = path.join(".teamagent", "last-wiki-pull.md");

export interface WikiHarvestEntry {
  title: string;
  sourceType: string;
  tldr: string;
}

export interface WikiHarvestRecord {
  trigger: "manual" | "session-start" | "scheduled";
  forced: boolean;
  added: number;
  archived: number;
  skipped: boolean;
  skipReason?: string;
  errors: Array<{ stage: string; error: string }>;
  newEntries: WikiHarvestEntry[];
}

export function getWikiHarvestPath(cwd: string): string {
  return path.join(cwd, WIKI_HARVEST_FILE_RELATIVE);
}

export function appendWikiHarvest(cwd: string, record: WikiHarvestRecord): void {
  const file = getWikiHarvestPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ts = new Date().toISOString();
  const lines: string[] = [];
  lines.push("");
  lines.push(`## ${ts} — ${record.trigger}${record.forced ? " (force)" : ""}`);
  lines.push("");
  if (record.skipped) {
    lines.push(`- skipped: ${record.skipReason ?? "unknown"}`);
  } else {
    lines.push(`- stats: added=${record.added}, archived=${record.archived}, errors=${record.errors.length}`);
  }
  if (record.errors.length > 0) {
    lines.push("- errors:");
    for (const e of record.errors) {
      lines.push(`  - ${e.stage}: ${e.error}`);
    }
  }
  if (record.newEntries.length === 0) {
    if (!record.skipped) lines.push("- 无新增条目");
  } else {
    lines.push(`- 新增 ${record.newEntries.length} 条:`);
    for (const e of record.newEntries) {
      const tldr = e.tldr.length > 120 ? `${e.tldr.slice(0, 117)}...` : e.tldr;
      lines.push(`  - [${e.sourceType}] ${e.title} — ${tldr}`);
    }
  }
  lines.push("");
  fs.appendFileSync(file, lines.join("\n"), "utf-8");
}
