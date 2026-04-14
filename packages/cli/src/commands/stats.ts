import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { JsonlKnowledgeStore } from "@teamagent/adapters";
import type { KnowledgeEntry } from "@teamagent/types";

export interface StatsOptions {
  personalPath?: string;
  teamPath?: string;
  globalPath?: string;
  cwd?: string;
  homeDir?: string;
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
  };
}

function loadIfExists(p: string): KnowledgeEntry[] {
  if (!fs.existsSync(p)) return [];
  try {
    return new JsonlKnowledgeStore(p).getAll();
  } catch {
    return [];
  }
}

/** 纯函数：给定条目列表，生成 stats 报告文本。 */
export function renderStats(
  byScope: { personal: KnowledgeEntry[]; team: KnowledgeEntry[]; global: KnowledgeEntry[] },
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

  return lines.join("\n") + "\n";
}

/** IO 入口：读三个 scope 的知识库并渲染统计。 */
export function executeStats(opts: StatsOptions = {}): string {
  const paths = resolvePaths(opts);
  return renderStats({
    personal: loadIfExists(paths.personalPath),
    team: loadIfExists(paths.teamPath),
    global: loadIfExists(paths.globalPath),
  });
}
