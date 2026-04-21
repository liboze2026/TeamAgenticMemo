/**
 * wiki:refresh core logic. Exported for testing and CLI reuse.
 * NO top-level side effects — safe to import from tests.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { DatabaseSync } from "node:sqlite";

export interface TestDeps {
  openDb?: (p: string) => DatabaseSync;
  runPipeline?: (db: DatabaseSync) => Promise<{
    added: number;
    skipped: number;
    rejected: number;
    errors: Array<{ source: string; error: string }>;
  }>;
  runSweep?: (
    db: DatabaseSync,
    now: Date,
    opts: { zeroHitMinAgeDays?: number; perSourceKeep?: number },
  ) => {
    archived: Array<{ knowledgeId: string; reason: "zero-hit-aged" | "source-overflow" }>;
    byReason: { zeroHitAged: number; sourceOverflow: number };
  };
}

export interface RefreshOptions {
  cwd: string;
  force: boolean;
  debounceHours?: number;
  zeroHitMinAgeDays?: number;
  perSourceKeep?: number;
  _testDeps?: TestDeps;
}

export interface RefreshResult {
  skipped: boolean;
  skipReason?: "debounced" | "db-missing";
  added: number;
  archived: number;
  errors: Array<{ stage: string; error: string }>;
}

const DEFAULT_DEBOUNCE_HOURS = 24;

export async function runWikiRefresh(opts: RefreshOptions): Promise<RefreshResult> {
  const result: RefreshResult = {
    skipped: false,
    added: 0,
    archived: 0,
    errors: [],
  };
  const teamagentDir = path.join(opts.cwd, ".teamagent");
  const debounceHours = opts.debounceHours ?? DEFAULT_DEBOUNCE_HOURS;

  // 1. debounce
  try {
    const { LastPullMarker } = await import("@teamagent/adapters");
    const marker = new LastPullMarker(teamagentDir);
    if (!opts.force && marker.shouldSkip(new Date(), debounceHours)) {
      return { ...result, skipped: true, skipReason: "debounced" };
    }
  } catch (e) {
    result.errors.push({ stage: "debounce-check", error: String(e) });
  }

  // 2. open db (silent fail → skip)
  let db: DatabaseSync;
  const dbPath = path.join(teamagentDir, "knowledge.db");
  try {
    const openDb =
      opts._testDeps?.openDb ??
      (await import("@teamagent/adapters/storage/sqlite/schema")).openDb;
    db = openDb(dbPath);
  } catch (e) {
    result.errors.push({ stage: "open-db", error: String(e) });
    return { ...result, skipped: true, skipReason: "db-missing" };
  }

  // 3. pipeline.run()
  try {
    if (opts._testDeps?.runPipeline) {
      const report = await opts._testDeps.runPipeline(db);
      result.added = report.added;
      for (const e of report.errors) {
        result.errors.push({ stage: `pipeline:${e.source}`, error: e.error });
      }
    } else {
      const { ClaudeCodeLLMClient, XenovaEmbedder, WikiPipeline } = await import("@teamagent/adapters");
      const llm = new ClaudeCodeLLMClient();
      const embedder = new XenovaEmbedder();
      const pipeline = new WikiPipeline(db, llm, embedder);
      const report = await pipeline.run({});
      result.added = report.added;
      for (const e of report.errors) {
        result.errors.push({ stage: `pipeline:${e.source}`, error: e.error });
      }
    }
  } catch (e) {
    result.errors.push({ stage: "pipeline-run", error: String(e) });
  }

  // 4. sweeper
  try {
    if (opts._testDeps?.runSweep) {
      const sweepReport = opts._testDeps.runSweep(db!, new Date(), {
        zeroHitMinAgeDays: opts.zeroHitMinAgeDays,
        perSourceKeep: opts.perSourceKeep,
      });
      result.archived = sweepReport.archived.length;
    } else {
      const { ArchiveSweeper } = await import("@teamagent/adapters");
      const sweepReport = new ArchiveSweeper(db!).sweep(new Date(), {
        zeroHitMinAgeDays: opts.zeroHitMinAgeDays,
        perSourceKeep: opts.perSourceKeep,
      });
      result.archived = sweepReport.archived.length;
    }
  } catch (e) {
    result.errors.push({ stage: "sweep", error: String(e) });
  }

  // 5. write marker
  try {
    const { LastPullMarker } = await import("@teamagent/adapters");
    new LastPullMarker(teamagentDir).write({
      attemptedAt: new Date(),
      added: result.added,
      archived: result.archived,
    });
  } catch (e) {
    result.errors.push({ stage: "marker-write", error: String(e) });
  }

  return result;
}

export async function logErrors(errors: Array<{ stage: string; error: string }>): Promise<void> {
  if (errors.length === 0) return;
  try {
    const logPath = path.join(os.homedir(), ".teamagent", "wiki-refresh-errors.log");
    mkdirSync(path.dirname(logPath), { recursive: true });
    const line = `[${new Date().toISOString()}] ${JSON.stringify(errors)}\n`;
    appendFileSync(logPath, line, "utf-8");
  } catch { /* silent */ }
}
