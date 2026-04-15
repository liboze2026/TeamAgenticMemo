import os from "node:os";
import path from "node:path";
import {
  JsonlEventLog,
  JsonlKnowledgeStore,
  MarkdownCompiler,
} from "@teamagent/adapters";
import {
  defaultCalibrator,
  runCalibrationPipeline,
  type AdjustmentRecord,
} from "@teamagent/core";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

export interface CalibrateOptions {
  cwd?: string;
  homeDir?: string;
  personalPath?: string;
  teamPath?: string;
  globalPath?: string;
  eventsPath?: string;
  claudeMdPath?: string;
  /** 只看会做什么，不写盘 */
  dryRun?: boolean;
  /** 只考虑最近 N 天的事件（默认全部） */
  days?: number;
  now?: () => Date;
}

export interface CalibrateResult {
  dryRun: boolean;
  byScope: Array<{
    scope: "personal" | "team" | "global";
    storePath: string;
    scanned: number;
    adjustedCount: number;
    archivedCount: number;
    adjustments: AdjustmentRecord[];
  }>;
  totalAdjusted: number;
  totalArchived: number;
}

function resolvePaths(opts: CalibrateOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    personalPath:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    teamPath: opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    globalPath:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    eventsPath: opts.eventsPath ?? path.join(home, ".teamagent", "events.jsonl"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
  };
}

function filterEventsByDays(
  events: PersistedEvent[],
  days: number | undefined,
  now: Date,
): PersistedEvent[] {
  if (!days || days <= 0) return events;
  const cutoff = now.getTime() - days * 24 * 3600 * 1000;
  return events.filter((e) => {
    try {
      return new Date(e.timestamp).getTime() >= cutoff;
    } catch {
      return true; // 时间戳坏的留下，由下游决定
    }
  });
}

function makeEventId(now: Date): string {
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `cal-${ts}-${rand}`;
}

/**
 * 把 AdjustmentRecord 转成 calibrator.adjusted PersistedEvent 写盘。
 * 这是 stats / Portal 后续读取的数据来源。
 */
function recordAdjustment(
  log: JsonlEventLog,
  _scope: string,
  adj: AdjustmentRecord,
  now: Date,
): void {
  log.append({
    id: makeEventId(now),
    kind: "calibrator.adjusted",
    knowledge_id: adj.knowledge_id,
    confidence_before: adj.before,
    confidence_after: adj.after,
    status_after: adj.status_after,
    timestamp: now.toISOString(),
    schema_version: 1,
  });
}

export async function executeCalibrate(
  opts: CalibrateOptions = {},
): Promise<CalibrateResult> {
  const paths = resolvePaths(opts);
  const dryRun = opts.dryRun ?? false;
  const now = opts.now ?? (() => new Date());
  const nowDate = now();

  let events: PersistedEvent[] = [];
  try {
    events = new JsonlEventLog(paths.eventsPath).readAll();
  } catch {
    // events.jsonl 不存在或损坏 → 视为空（calibrator 将无信号 = 不动）
  }
  events = filterEventsByDays(events, opts.days, nowDate);

  const scopes: Array<{
    scope: "personal" | "team" | "global";
    storePath: string;
  }> = [
    { scope: "personal", storePath: paths.personalPath },
    { scope: "team", storePath: paths.teamPath },
    { scope: "global", storePath: paths.globalPath },
  ];

  const byScope: CalibrateResult["byScope"] = [];
  let totalAdjusted = 0;
  let totalArchived = 0;

  for (const { scope, storePath } of scopes) {
    let store: JsonlKnowledgeStore;
    try {
      store = new JsonlKnowledgeStore(storePath);
    } catch {
      byScope.push({
        scope,
        storePath,
        scanned: 0,
        adjustedCount: 0,
        archivedCount: 0,
        adjustments: [],
      });
      continue;
    }

    if (dryRun) {
      // 不修改 store；用一个 view 跑 calibrator 得到预测
      const fakeStore = makeReadOnlyStore(store);
      const pred = await runCalibrationPipeline({
        calibrator: defaultCalibrator,
        store: fakeStore,
        events,
        now,
      });
      byScope.push({
        scope,
        storePath,
        scanned: pred.scanned,
        adjustedCount: pred.adjusted.length,
        archivedCount: pred.archivedNew.length,
        adjustments: pred.adjusted,
      });
      totalAdjusted += pred.adjusted.length;
      totalArchived += pred.archivedNew.length;
      continue;
    }

    const result = await runCalibrationPipeline({
      calibrator: defaultCalibrator,
      store,
      events,
      now,
    });

    // 把 adjustments 写成 calibrator.adjusted 事件（stats 读它做 top 5）
    if (result.adjusted.length > 0) {
      const eventLog = new JsonlEventLog(paths.eventsPath);
      for (const adj of result.adjusted) {
        try {
          recordAdjustment(eventLog, scope, adj, nowDate);
        } catch {
          // 单条写失败不影响后续
        }
      }
    }

    byScope.push({
      scope,
      storePath,
      scanned: result.scanned,
      adjustedCount: result.adjusted.length,
      archivedCount: result.archivedNew.length,
      adjustments: result.adjusted,
    });
    totalAdjusted += result.adjusted.length;
    totalArchived += result.archivedNew.length;
  }

  // 若有调整且非 dry-run，重编译 CLAUDE.md
  if (!dryRun && totalAdjusted > 0) {
    const all: KnowledgeEntry[] = [];
    for (const p of [paths.personalPath, paths.teamPath, paths.globalPath]) {
      try {
        all.push(...new JsonlKnowledgeStore(p).getActive());
      } catch {
        // skip
      }
    }
    try {
      new MarkdownCompiler(paths.claudeMdPath, () => nowDate.toISOString()).writeToFile(
        all,
      );
    } catch {
      // 重编译失败不算 fatal
    }
  }

  return { dryRun, byScope, totalAdjusted, totalArchived };
}

/** 包一层只读 store 用于 dry-run（calibrator-pipeline 仍调 update，但 noop） */
function makeReadOnlyStore(real: JsonlKnowledgeStore): JsonlKnowledgeStore {
  // Pipeline only calls getAll/update; intercept update to noop
  const proxy = Object.create(real) as JsonlKnowledgeStore;
  (proxy as unknown as { update: () => void }).update = () => {};
  return proxy;
}

export function parseCalibrateArgs(argv: string[]): CalibrateOptions {
  const opts: CalibrateOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--days" && argv[i + 1]) {
      opts.days = parseInt(argv[i + 1]!, 10);
      i++;
    } else if (a.startsWith("--days=")) {
      opts.days = parseInt(a.slice("--days=".length), 10);
    }
  }
  return opts;
}

export function renderCalibrateResult(r: CalibrateResult): string {
  const lines: string[] = [];
  lines.push(r.dryRun ? "🔍 TeamAgent Calibrate (dry-run)" : "⚖️  TeamAgent Calibrate");
  lines.push("");
  for (const { scope, scanned, adjustedCount, archivedCount, adjustments } of r.byScope) {
    if (scanned === 0) {
      lines.push(`  ${scope.padEnd(8)} 无 store / 跳过`);
      continue;
    }
    if (adjustedCount === 0) {
      lines.push(`  ${scope.padEnd(8)} 扫描 ${scanned}, 无变化`);
      continue;
    }
    lines.push(
      `  ${scope.padEnd(8)} 扫描 ${scanned}, 调整 ${adjustedCount}` +
        (archivedCount > 0 ? ` (含归档 ${archivedCount})` : ""),
    );
    for (const adj of adjustments.slice(0, 5)) {
      const arrow =
        adj.status_after !== adj.status_before
          ? ` → ${adj.status_after}`
          : "";
      lines.push(
        `    - ${adj.knowledge_id}: ${adj.before.toFixed(2)} → ${adj.after.toFixed(2)} (${adj.delta > 0 ? "+" : ""}${adj.delta.toFixed(2)})${arrow}`,
      );
    }
    if (adjustments.length > 5) {
      lines.push(`    ... (${adjustments.length - 5} more)`);
    }
  }
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(
    `  总计: ${r.totalAdjusted} 条调整${r.totalArchived > 0 ? `, ${r.totalArchived} 条归档` : ""}`,
  );
  if (r.dryRun) {
    lines.push("  (dry-run，未写入)");
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n") + "\n";
}
