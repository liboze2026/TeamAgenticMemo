import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { KnowledgeEntry } from "@teamagent/types";

export interface MigrateOptions {
  homeDir?: string;
  cwd?: string;
  dryRun?: boolean;
}

export interface MigrateResult {
  readEntries: number;
  byScope: { personal: number; team: number; global: number };
  written: number;
  rejected: number;
  rejectionLog: Array<{ id: string; reason: string }>;
}

function readJsonlIfExists(p: string): KnowledgeEntry[] {
  if (!fs.existsSync(p)) return [];
  const content = fs.readFileSync(p, "utf-8");
  return content
    .split("\n")
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line) as KnowledgeEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is KnowledgeEntry => e !== null);
}

export async function executeMigrate(opts: MigrateOptions = {}): Promise<MigrateResult> {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const dryRun = opts.dryRun ?? false;

  const personalPath = path.join(home, ".teamagent", "personal", "knowledge.jsonl");
  const teamPath = path.join(cwd, ".teamagent", "knowledge.jsonl");
  const globalPath = path.join(home, ".teamagent", "global", "knowledge.jsonl");

  const personal = readJsonlIfExists(personalPath);
  const team = readJsonlIfExists(teamPath);
  const global = readJsonlIfExists(globalPath);

  const all = [...personal, ...team, ...global];

  const result: MigrateResult = {
    readEntries: all.length,
    byScope: {
      personal: personal.length,
      team: team.length,
      global: global.length,
    },
    written: 0,
    rejected: 0,
    rejectionLog: [],
  };

  if (dryRun) {
    return result;
  }

  // write-side: Task 9 填充
  throw new Error("write-side not implemented yet (see Task 9)");
}
