import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { JsonlEventLog, JsonlKnowledgeStore } from "@teamagent/adapters";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

export interface StatsOptions {
  personalPath?: string;
  teamPath?: string;
  globalPath?: string;
  eventsPath?: string;
  cwd?: string;
  homeDir?: string;
  /** 校准变化窗口（天），默认 7 */
  windowDays?: number;
  now?: () => Date;
}

/** 校准变化聚合：按 knowledge_id 累计该窗口内的总 delta */
export interface ConfidenceMovement {
  knowledge_id: string;
  totalDelta: number;
  trigger?: string;
  archivedThisWindow: boolean;
}

function resolvePaths(opts: StatsOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    personalPath:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    teamPath: opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    globalPath:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    eventsPath: opts.eventsPath ?? path.join(home, ".teamagent", "events.jsonl"),
  };
}

/**
 * 纯函数：从 calibrator.adjusted 事件聚合每条规则的 confidence 变化。
 * 仅看 windowDays 内的事件，按 |totalDelta| 倒序。
 */
export function aggregateConfidenceMovements(
  events: PersistedEvent[],
  windowDays: number,
  now: Date,
): ConfidenceMovement[] {
  const cutoff = now.getTime() - windowDays * 24 * 3600 * 1000;
  const recent = events.filter((e) => {
    if (e.kind !== "calibrator.adjusted") return false;
    if (!e.knowledge_id) return false;
    if (typeof e.confidence_before !== "number") return false;
    if (typeof e.confidence_after !== "number") return false;
    try {
      return new Date(e.timestamp).getTime() >= cutoff;
    } catch {
      return false;
    }
  });

  const byId = new Map<string, ConfidenceMovement>();
  for (const e of recent) {
    const id = e.knowledge_id!;
    const delta = (e.confidence_after as number) - (e.confidence_before as number);
    const existing = byId.get(id);
    if (existing) {
      existing.totalDelta += delta;
      if (e.status_after === "archived") existing.archivedThisWindow = true;
    } else {
      byId.set(id, {
        knowledge_id: id,
        totalDelta: delta,
        archivedThisWindow: e.status_after === "archived",
      });
    }
  }

  return [...byId.values()].sort(
    (a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta),
  );
}

function loadIfExists(p: string): KnowledgeEntry[] {
  if (!fs.existsSync(p)) return [];
  try {
    return new JsonlKnowledgeStore(p).getAll();
  } catch {
    return [];
  }
}

/** 纯函数：给定条目列表 + 校准变化，生成 stats 报告文本。 */
export function renderStats(
  byScope: { personal: KnowledgeEntry[]; team: KnowledgeEntry[]; global: KnowledgeEntry[] },
  movements: ConfidenceMovement[] = [],
  windowDays = 7,
): string {
  const all = [...byScope.personal, ...byScope.team, ...byScope.global];
  const active = all.filter((e) => e.status === "active");
  const archived = all.filter((e) => e.status === "archived");

  if (all.length === 0) {
    return [
      "📊 TeamAgent 知识库统计",
      "",
      "尚无知识条目。",
      "",
      "录入方式:",
      "  pnpm teamagent pitfall            交互式录入",
      "  pnpm teamagent pitfall --non-interactive --trigger=... --wrong=... --correct=... --reason=...",
      "",
    ].join("\n");
  }

  const byCategory: Record<string, number> = { C: 0, E: 0, S: 0, K: 0 };
  for (const e of active) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }

  const byScopeLevel = {
    personal: byScope.personal.filter((e) => e.status === "active").length,
    team: byScope.team.filter((e) => e.status === "active").length,
    global: byScope.global.filter((e) => e.status === "active").length,
  };

  const topHits = active
    .filter((e) => e.hit_count > 0)
    .sort((a, b) => b.hit_count - a.hit_count)
    .slice(0, 5);

  const recent = active
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  const lines: string[] = [];
  lines.push("📊 TeamAgent 知识库统计");
  lines.push("");
  lines.push(
    `总数: ${all.length} (活跃 ${active.length}${archived.length > 0 ? `, 归档 ${archived.length}` : ""})`,
  );
  lines.push("");
  lines.push("按作用域:");
  lines.push(`  personal  ${byScopeLevel.personal}`);
  lines.push(`  team      ${byScopeLevel.team}`);
  lines.push(`  global    ${byScopeLevel.global}`);
  lines.push("");
  lines.push("按分类:");
  lines.push(`  C 代码层  ${byCategory.C}`);
  lines.push(`  E 工程层  ${byCategory.E}`);
  lines.push(`  S 策略层  ${byCategory.S}`);
  lines.push(`  K 认知层  ${byCategory.K}`);
  lines.push("");

  if (topHits.length > 0) {
    lines.push(`Top ${topHits.length} 高频命中:`);
    for (const e of topHits) {
      lines.push(
        `  [${e.hit_count}次] ${e.trigger} → ${e.correct_pattern} (conf=${e.confidence.toFixed(2)})`,
      );
    }
    lines.push("");
  }

  lines.push(`最近 ${recent.length} 条新增:`);
  for (const e of recent) {
    const date = e.created_at.slice(0, 10);
    lines.push(`  [${date}] ${e.category}/${e.tags[0] ?? "-"}  ${e.trigger}`);
  }

  // M6: 本窗口 confidence 变化 top 5
  if (movements.length > 0) {
    lines.push("");
    lines.push(`本周（${windowDays} 天）confidence 变化 top ${Math.min(5, movements.length)}:`);
    const triggerById = new Map<string, string>();
    for (const e of all) triggerById.set(e.id, e.trigger);
    for (const m of movements.slice(0, 5)) {
      const sign = m.totalDelta > 0 ? "+" : "";
      const tag = m.archivedThisWindow ? " [自动归档]" : "";
      const trig = triggerById.get(m.knowledge_id) ?? "(已删)";
      lines.push(
        `  ${sign}${m.totalDelta.toFixed(2)}  ${m.knowledge_id}${tag}`,
      );
      lines.push(`         ${trig.slice(0, 80)}`);
    }
  }

  return lines.join("\n") + "\n";
}

/** IO 入口：读三个 scope 的知识库 + events.jsonl 并渲染统计。 */
export function executeStats(opts: StatsOptions = {}): string {
  const paths = resolvePaths(opts);
  const windowDays = opts.windowDays ?? 7;
  const now = (opts.now ?? (() => new Date()))();

  let events: PersistedEvent[] = [];
  try {
    if (fs.existsSync(paths.eventsPath)) {
      events = new JsonlEventLog(paths.eventsPath).readAll();
    }
  } catch {
    // 损坏 → 视为空
  }
  const movements = aggregateConfidenceMovements(events, windowDays, now);

  return renderStats(
    {
      personal: loadIfExists(paths.personalPath),
      team: loadIfExists(paths.teamPath),
      global: loadIfExists(paths.globalPath),
    },
    movements,
    windowDays,
  );
}
