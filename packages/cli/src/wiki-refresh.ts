/**
 * wiki:refresh core logic. Exported for testing and CLI reuse.
 * NO top-level side effects — safe to import from tests.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { DatabaseSync } from "node:sqlite";
import type { AttributionBus } from "@teamagent/ports";
import type { AttributionEvent } from "@teamagent/types";

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
  bus?: AttributionBus;
  /** Who triggered this refresh — recorded into last-wiki-pull.md */
  trigger?: "manual" | "session-start" | "scheduled";
  _testDeps?: TestDeps;
}

function emit(bus: AttributionBus | undefined, action: string, detail: Partial<AttributionEvent> = {}): void {
  if (!bus) return;
  bus.emit({
    source: "wiki-refresh",
    action,
    severity: detail.severity ?? "info",
    timestamp: new Date().toISOString(),
    ...detail,
  });
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
  const startedAt = new Date();

  // Load per-project config (defaults on missing/malformed)
  let cfg: {
    autoRefresh: { enabled: boolean; debounceHours: number };
    sweep: { enabled: boolean; zeroHitMinAgeDays: number; perSourceKeep: number };
    manualStack: string[];
  };
  try {
    const { loadWikiConfig } = await import("@teamagent/adapters/wiki/config-loader");
    cfg = loadWikiConfig(opts.cwd);
  } catch {
    cfg = {
      autoRefresh: { enabled: true, debounceHours: 24 },
      sweep: { enabled: true, zeroHitMinAgeDays: 60, perSourceKeep: 3 },
      manualStack: [],
    };
  }
  const debounceHours = opts.debounceHours ?? cfg.autoRefresh.debounceHours;
  const zeroHitMinAgeDays = opts.zeroHitMinAgeDays ?? cfg.sweep.zeroHitMinAgeDays;
  const perSourceKeep = opts.perSourceKeep ?? cfg.sweep.perSourceKeep;

  emit(opts.bus, "started");

  // 1. debounce
  try {
    const { LastPullMarker } = await import("@teamagent/adapters/wiki/last-pull-marker");
    const marker = new LastPullMarker(teamagentDir);
    if (!opts.force && marker.shouldSkip(new Date(), debounceHours)) {
      emit(opts.bus, "skipped", { userFacingValue: "wiki 24h 内刚刷过，跳过" });
      const skipResult: RefreshResult = { ...result, skipped: true, skipReason: "debounced" };
      try {
        const { appendWikiHarvest } = await import("./wiki-harvest-writer.js");
        appendWikiHarvest(opts.cwd, {
          trigger: opts.trigger ?? "manual",
          forced: opts.force,
          added: 0,
          archived: 0,
          skipped: true,
          skipReason: "debounced",
          errors: [],
          newEntries: [],
        });
      } catch { /* silent */ }
      return skipResult;
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
    emit(opts.bus, "skipped", { userFacingValue: "没有 knowledge.db，跳过" });
    const skipResult: RefreshResult = { ...result, skipped: true, skipReason: "db-missing" };
    try {
      const { appendWikiHarvest } = await import("./wiki-harvest-writer.js");
      appendWikiHarvest(opts.cwd, {
        trigger: opts.trigger ?? "manual",
        forced: opts.force,
        added: 0,
        archived: 0,
        skipped: true,
        skipReason: "db-missing",
        errors: result.errors,
        newEntries: [],
      });
    } catch { /* silent */ }
    return skipResult;
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
      const { ClaudeCodeLLMClient } = await import("@teamagent/adapters");
      const { XenovaEmbedder } = await import("@teamagent/adapters/wiki/xenova-embedder");
      const { WikiPipeline } = await import("@teamagent/adapters/wiki/wiki-pipeline");
      const llm = new ClaudeCodeLLMClient();
      const embedder = new XenovaEmbedder();
      const pipeline = new WikiPipeline(db, llm, embedder);
      const report = await pipeline.run({
        manualStackOverride: cfg.manualStack.length > 0 ? cfg.manualStack : undefined,
      });
      result.added = report.added;
      for (const e of report.errors) {
        result.errors.push({ stage: `pipeline:${e.source}`, error: e.error });
      }
    }
  } catch (e) {
    result.errors.push({ stage: "pipeline-run", error: String(e) });
  }

  // 4. sweeper
  if (cfg.sweep.enabled) {
    try {
      if (opts._testDeps?.runSweep) {
        const sweepReport = opts._testDeps.runSweep(db!, new Date(), { zeroHitMinAgeDays, perSourceKeep });
        result.archived = sweepReport.archived.length;
      } else {
        const { ArchiveSweeper } = await import("@teamagent/adapters/wiki/archive-sweeper");
        const sweepReport = new ArchiveSweeper(db!).sweep(new Date(), { zeroHitMinAgeDays, perSourceKeep });
        result.archived = sweepReport.archived.length;
      }
    } catch (e) {
      result.errors.push({ stage: "sweep", error: String(e) });
    }
  }

  // 5. write marker
  try {
    const { LastPullMarker } = await import("@teamagent/adapters/wiki/last-pull-marker");
    new LastPullMarker(teamagentDir).write({
      attemptedAt: new Date(),
      added: result.added,
      archived: result.archived,
    });
  } catch (e) {
    result.errors.push({ stage: "marker-write", error: String(e) });
  }

  emit(opts.bus, "completed", {
    target: { count: result.added },
    userFacingValue: `新增 ${result.added} 条 wiki`,
  });
  if (result.archived > 0) {
    emit(opts.bus, "archived", {
      target: { count: result.archived },
      userFacingValue: `归档 ${result.archived} 条过时 wiki`,
    });
  }

  // 6. append harvest log so user can see what came in even if refresh ran detached
  try {
    const newEntries: Array<{ title: string; sourceType: string; tldr: string }> = [];
    if (result.added > 0 && db!) {
      const rows = db!
        .prepare(
          `SELECT k.trigger AS title, wm.source_type AS source_type, wm.tldr AS tldr
           FROM knowledge k
           JOIN wiki_meta wm ON k.id = wm.knowledge_id
           WHERE k.type = 'wiki' AND k.status = 'active' AND k.created_at >= ?
           ORDER BY k.created_at DESC
           LIMIT 50`,
        )
        .all(startedAt.toISOString()) as Array<{
          title: string;
          source_type: string;
          tldr: string;
        }>;
      for (const r of rows) {
        newEntries.push({
          title: r.title ?? "(untitled)",
          sourceType: r.source_type ?? "unknown",
          tldr: r.tldr ?? "",
        });
      }
    }
    const { appendWikiHarvest } = await import("./wiki-harvest-writer.js");
    appendWikiHarvest(opts.cwd, {
      trigger: opts.trigger ?? "manual",
      forced: opts.force,
      added: result.added,
      archived: result.archived,
      skipped: false,
      errors: result.errors,
      newEntries,
    });
  } catch (e) {
    result.errors.push({ stage: "harvest-write", error: String(e) });
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
