import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { JsonlEventLog, JsonlKnowledgeStore } from "@teamagent/adapters";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

export interface DogfoodReportOptions {
  cwd?: string;
  homeDir?: string;
  personalPath?: string;
  teamPath?: string;
  globalPath?: string;
  eventsPath?: string;
  /** 输出 Markdown 路径；默认 docs/dogfood/自举报告.md */
  outputPath?: string;
  now?: () => Date;
}

export interface DogfoodReportResult {
  outputPath: string;
  totalEntries: number;
  totalEvents: number;
  scopes: Record<"personal" | "team" | "global", number>;
  topFired: Array<{ knowledge_id: string; trigger: string; fires: number }>;
  topConfidenceGain: Array<{ knowledge_id: string; trigger: string; totalDelta: number }>;
  archivedCount: number;
}

function resolvePaths(opts: DogfoodReportOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    home,
    cwd,
    personalPath:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    teamPath: opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    globalPath:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    eventsPath: opts.eventsPath ?? path.join(home, ".teamagent", "events.jsonl"),
    outputPath: opts.outputPath ?? path.join(cwd, "docs", "dogfood", "自举报告.md"),
  };
}

/** 读 git log 拿提交简要时间线（按 milestone tag 聚合）。 */
function readGitTimeline(cwd: string): Array<{ hash: string; date: string; message: string }> {
  try {
    const out = execSync(
      'git log --pretty=format:"%h|%ad|%s" --date=short -100',
      { cwd, encoding: "utf-8" },
    );
    return out
      .split("\n")
      .map((line) => {
        const [hash, date, ...rest] = line.split("|");
        return { hash: hash ?? "", date: date ?? "", message: rest.join("|") };
      })
      .filter((c) => c.hash);
  } catch {
    return [];
  }
}

function loadStore(p: string): KnowledgeEntry[] {
  if (!fs.existsSync(p)) return [];
  try {
    return new JsonlKnowledgeStore(p).getAll();
  } catch {
    return [];
  }
}

function loadEvents(p: string): PersistedEvent[] {
  if (!fs.existsSync(p)) return [];
  try {
    return new JsonlEventLog(p).readAll();
  } catch {
    return [];
  }
}

/**
 * 生成 dogfood 报告。读 events + knowledge + git log，输出 Markdown。
 * 数据**完全**从系统状态计算——本报告本身就是 Phase 1 的"第三方独立证据"
 * （由系统自动生成，不经人工修饰）。
 */
export async function executeDogfoodReport(
  opts: DogfoodReportOptions = {},
): Promise<DogfoodReportResult> {
  const paths = resolvePaths(opts);
  const now = (opts.now ?? (() => new Date()))();

  const personal = loadStore(paths.personalPath);
  const team = loadStore(paths.teamPath);
  const global = loadStore(paths.globalPath);
  const allEntries = [...personal, ...team, ...global];

  const events = loadEvents(paths.eventsPath);
  const timeline = readGitTimeline(paths.cwd);

  // ---- 聚合 ----
  const triggerById = new Map<string, string>();
  for (const e of allEntries) triggerById.set(e.id, e.trigger);

  // 命中频次 top
  const fireCount = new Map<string, number>();
  for (const e of events) {
    if (e.knowledge_id && /^hook-pre/.test(e.kind)) {
      fireCount.set(e.knowledge_id, (fireCount.get(e.knowledge_id) ?? 0) + 1);
    }
  }
  const topFired = [...fireCount.entries()]
    .map(([knowledge_id, fires]) => ({
      knowledge_id,
      trigger: triggerById.get(knowledge_id) ?? "(已删)",
      fires,
    }))
    .sort((a, b) => b.fires - a.fires)
    .slice(0, 5);

  // confidence 变化 top
  const deltaById = new Map<string, number>();
  for (const e of events) {
    if (
      e.kind === "calibrator.adjusted" &&
      e.knowledge_id &&
      typeof e.confidence_before === "number" &&
      typeof e.confidence_after === "number"
    ) {
      const d = e.confidence_after - e.confidence_before;
      deltaById.set(e.knowledge_id, (deltaById.get(e.knowledge_id) ?? 0) + d);
    }
  }
  const topConfidenceGain = [...deltaById.entries()]
    .map(([knowledge_id, totalDelta]) => ({
      knowledge_id,
      trigger: triggerById.get(knowledge_id) ?? "(已删)",
      totalDelta,
    }))
    .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta))
    .slice(0, 5);

  // archived 计数
  const archivedCount = allEntries.filter((e) => e.status === "archived").length;

  // ---- 渲染 ----
  const md = renderDogfoodReport({
    now,
    personal,
    team,
    global,
    events,
    timeline,
    topFired,
    topConfidenceGain,
    archivedCount,
  });

  fs.mkdirSync(path.dirname(paths.outputPath), { recursive: true });
  fs.writeFileSync(paths.outputPath, md, "utf-8");

  return {
    outputPath: paths.outputPath,
    totalEntries: allEntries.length,
    totalEvents: events.length,
    scopes: { personal: personal.length, team: team.length, global: global.length },
    topFired,
    topConfidenceGain,
    archivedCount,
  };
}

interface RenderInput {
  now: Date;
  personal: KnowledgeEntry[];
  team: KnowledgeEntry[];
  global: KnowledgeEntry[];
  events: PersistedEvent[];
  timeline: Array<{ hash: string; date: string; message: string }>;
  topFired: Array<{ knowledge_id: string; trigger: string; fires: number }>;
  topConfidenceGain: Array<{
    knowledge_id: string;
    trigger: string;
    totalDelta: number;
  }>;
  archivedCount: number;
}

export function renderDogfoodReport(input: RenderInput): string {
  const { now, personal, team, global, events, timeline, topFired, topConfidenceGain, archivedCount } =
    input;
  const all = [...personal, ...team, ...global];
  const active = all.filter((e) => e.status === "active");

  const byCategory: Record<string, number> = { C: 0, E: 0, S: 0, K: 0 };
  for (const e of active) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;

  const eventKinds: Record<string, number> = {};
  for (const e of events) eventKinds[e.kind] = (eventKinds[e.kind] ?? 0) + 1;

  const corrections = events.filter((e) => /^hook-pre/.test(e.kind)).length;
  const calibrations = events.filter((e) => e.kind === "calibrator.adjusted").length;

  const lines: string[] = [];
  lines.push("# TeamAgent 自举报告（Phase 1）");
  lines.push("");
  lines.push(`> 生成时间: ${now.toISOString()}`);
  lines.push("> 数据完全来自系统自身：events.jsonl + 三个 scope 的 knowledge.jsonl + git log");
  lines.push("> 由 `teamagent dogfood-report` 自动生成，未经人工修饰");
  lines.push("");

  lines.push("## 一句话结论");
  lines.push("");
  lines.push(
    `Phase 1 期间累计积累 **${all.length} 条知识**（${active.length} 条活跃${archivedCount > 0 ? `、${archivedCount} 条自动归档` : ""}），` +
      `Hook 拦截 **${corrections} 次**，Calibrator 调整 **${calibrations} 次**。`,
  );
  lines.push("");

  lines.push("## 知识库");
  lines.push("");
  lines.push("| 维度 | 值 |");
  lines.push("|------|----|");
  lines.push(`| 总条目 | ${all.length} |`);
  lines.push(`| 活跃 | ${active.length} |`);
  lines.push(`| 自动归档 | ${archivedCount} |`);
  lines.push(`| personal | ${personal.length} |`);
  lines.push(`| team | ${team.length} |`);
  lines.push(`| global | ${global.length} |`);
  lines.push(`| C 代码层 | ${byCategory.C} |`);
  lines.push(`| E 工程层 | ${byCategory.E} |`);
  lines.push(`| S 策略层 | ${byCategory.S} |`);
  lines.push(`| K 认知层 | ${byCategory.K} |`);
  lines.push("");

  lines.push("## Hook 干预统计");
  lines.push("");
  lines.push("| 事件类型 | 次数 |");
  lines.push("|---------|------|");
  for (const [k, v] of Object.entries(eventKinds).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");

  lines.push(`## 命中频次 Top ${topFired.length}`);
  lines.push("");
  if (topFired.length === 0) {
    lines.push("(暂无命中记录)");
  } else {
    lines.push("| # | 命中数 | trigger | id |");
    lines.push("|---|-------|---------|-----|");
    topFired.forEach((r, i) => {
      lines.push(
        `| ${i + 1} | ${r.fires} | ${r.trigger.slice(0, 60)} | ${r.knowledge_id} |`,
      );
    });
  }
  lines.push("");

  lines.push(`## Confidence 变化 Top ${topConfidenceGain.length}`);
  lines.push("");
  if (topConfidenceGain.length === 0) {
    lines.push("(暂无校准记录——尚未跑过 calibrate)");
  } else {
    lines.push("| # | Δconfidence | trigger | id |");
    lines.push("|---|------------|---------|-----|");
    topConfidenceGain.forEach((r, i) => {
      const sign = r.totalDelta > 0 ? "+" : "";
      lines.push(
        `| ${i + 1} | ${sign}${r.totalDelta.toFixed(2)} | ${r.trigger.slice(0, 60)} | ${r.knowledge_id} |`,
      );
    });
  }
  lines.push("");

  lines.push("## Phase 1 git 时间线");
  lines.push("");
  if (timeline.length === 0) {
    lines.push("(无 git 历史)");
  } else {
    // 取 M0-M7 + Stage 0/A 标志性 commit
    const milestones = timeline.filter((c) =>
      /^(feat|fix|chore|test|docs|ci)\((m[0-9]+|stage0|compiler|hotfix)\)/.test(
        c.message,
      ),
    );
    lines.push("| date | hash | message |");
    lines.push("|------|------|---------|");
    for (const c of milestones.slice(0, 30)) {
      lines.push(`| ${c.date} | ${c.hash} | ${c.message.slice(0, 80)} |`);
    }
  }
  lines.push("");

  lines.push("## 关于这份报告");
  lines.push("");
  lines.push(
    "Plan v1.2 设计意图：Phase 1 收尾时由系统**自动生成**一份报告，作为对 'TeamAgent 是否真有用' 这个问题的**第三方独立证据**——所有数字来自磁盘上的 jsonl 文件，没人手动改。",
  );
  lines.push("");
  lines.push(
    `局限性：本报告**只能说明** "系统积累了什么、命中了什么、调整了什么"，**不能说明** "AI 因为这些规则真的少踩坑了多少"。后者需要 A/B benchmark（已规划进 Phase 2）。`,
  );

  return lines.join("\n") + "\n";
}

export function parseDogfoodReportArgs(argv: string[]): DogfoodReportOptions {
  const opts: DogfoodReportOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--output" && argv[i + 1]) {
      opts.outputPath = argv[i + 1];
      i++;
    } else if (a.startsWith("--output=")) {
      opts.outputPath = a.slice("--output=".length);
    }
  }
  return opts;
}
