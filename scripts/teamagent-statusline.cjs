#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  process.stdout.write("TeamAgent正在运行 · (sqlite不可用)");
  process.exit(0);
}

// CC 运行 statusLine 时 cwd = 当前项目根，不是 script 所在目录。
// 旧实现用 __dirname 凑巧在 dev repo 能 resolve，但 tarball 装到
// node_modules/teamagent/dist/ 之后 ../.teamagent/knowledge.db 指向
// 包内部（无 db），就会错报 0 条。
const fs = require("node:fs");
const PROJECT_DB = path.resolve(process.cwd(), ".teamagent/knowledge.db");
const GLOBAL_DB = path.join(os.homedir(), ".teamagent", "global.db");
const EVENTS_DB = path.join(os.homedir(), ".teamagent", "events.db");

const PROJECT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "pnpm-workspace.yaml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
];

function isProjectDir(cwd) {
  for (const m of PROJECT_MARKERS) {
    try {
      if (fs.existsSync(path.join(cwd, m))) return true;
    } catch { /* ignore */ }
  }
  return false;
}

function hasProjectDb() {
  try {
    return fs.existsSync(PROJECT_DB);
  } catch {
    return false;
  }
}

function tryOpenDb(dbPath) {
  try {
    return new DatabaseSync(dbPath, { readOnly: true });
  } catch {
    return null;
  }
}

function getEntryCount(db) {
  try {
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM knowledge WHERE status = 'active' AND (type IS NULL OR type != 'wiki')",
      )
      .get();
    return row ? row.n : null;
  } catch {
    return null;
  }
}

function getWikiCount(db) {
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM knowledge WHERE status = 'active' AND type = 'wiki'")
      .get();
    return row ? row.n : null;
  } catch {
    return null;
  }
}

function getLastWikiPullDate(db) {
  try {
    const row = db
      .prepare(
        "SELECT MAX(created_at) AS d FROM knowledge WHERE status = 'active' AND type = 'wiki'",
      )
      .get();
    if (!row || !row.d) return null;
    const d = new Date(row.d);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function getLastLearnedDate(db) {
  try {
    const row = db.prepare("SELECT MAX(created_at) AS d FROM knowledge WHERE status = 'active'").get();
    if (!row || !row.d) return null;
    const d = new Date(row.d);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

const HELPED_EVENT_KINDS = [
  "hook-pre.matched",
  "hook-pre.warned",
  "hook-pre.blocked",
  "hook-post.result",
  "ai.narrative.injected",
  "ai.narrative.complied",
  "pitfall.added",
  "compiler.updated",
  "extractor.extracted",
  "calibrator.adjusted",
  "init.completed",
];

const RISK_EVENT_KINDS = [
  "hook-pre.warned",
  "hook-pre.blocked",
  "ai.output.bad_pattern",
  "ai.narrative.recurred",
  "ai.user_input.flagged",
  "error.candidate.added",
];

const CONTRIBUTION_HINTS = {
  "hook-pre.matched": "刚命中规则",
  "hook-pre.warned": "刚提醒风险",
  "hook-pre.blocked": "刚拦截风险",
  "hook-post.result": "刚记录执行结果",
  "ai.override.ignored": "刚发现规则绕过",
  "ai.override.complied": "刚确认规则生效",
  "ai.override.blocked_circumvented": "刚发现拦截绕过",
  "pitfall.added": "刚记住踩坑",
  "compiler.updated": "刚更新规则注入",
  "extractor.extracted": "刚提炼经验",
  "calibrator.adjusted": "刚校准规则",
  "init.completed": "刚完成初始化",
  "scenario.run": "刚跑完场景",
  "error.candidate.added": "刚捕获失败信号",
  "error.candidate.approved": "刚沉淀新规则",
  "error.candidate.rejected": "刚清理误报",
  "ai.output.bad_pattern": "刚发现输出问题",
  "ai.narrative.injected": "刚注入提醒",
  "ai.narrative.recurred": "刚发现重复踩坑",
  "ai.narrative.complied": "刚确认提醒有效",
  "ai.user_input.flagged": "刚提醒输入风险",
};

function sinceIso(daysAgo) {
  const d = new Date();
  if (daysAgo === 0) {
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(d.getDate() - daysAgo);
  }
  return d.toISOString();
}

function countEventsSince(db, kinds, since) {
  if (!db || kinds.length === 0) return null;
  try {
    const placeholders = kinds.map(() => "?").join(",");
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM events WHERE kind IN (${placeholders}) AND timestamp >= ?`)
      .get(...kinds, since);
    return row ? row.n : null;
  } catch {
    return null;
  }
}

function getLatestContributionHint(db) {
  if (!db) return null;
  try {
    const row = db
      .prepare("SELECT kind FROM events ORDER BY timestamp DESC LIMIT 1")
      .get();
    return row ? CONTRIBUTION_HINTS[row.kind] ?? null : null;
  } catch {
    return null;
  }
}

function formatMetric(value) {
  return typeof value === "number" ? String(value) : "-";
}

function main() {
  // 未 init 且像项目 → 显眼提醒 (此路径在 --dangerously-skip-permissions 下也触发,
  // 因为 statusline 不经过 hook 系统)
  if (!hasProjectDb() && isProjectDir(process.cwd())) {
    process.stdout.write("⚠️  TeamAgent 未初始化本项目 · 运行 `teamagent init` 启用");
    return;
  }

  const projectDb = tryOpenDb(PROJECT_DB);
  const globalDb  = tryOpenDb(GLOBAL_DB);
  const eventsDb = tryOpenDb(EVENTS_DB);

  if (!projectDb && !globalDb && !eventsDb) {
    process.stdout.write("TeamAgent 未安装 · 运行 `npm install -g teamagent-X.Y.Z.tgz`");
    return;
  }

  // 两库分别取活跃数 + 最近更新日，聚合。
  let count = 0;
  let wikiCount = 0;
  let lastDate = null;
  let lastWikiDate = null;
  for (const db of [projectDb, globalDb]) {
    if (!db) continue;
    try {
      const c = getEntryCount(db);
      if (typeof c === "number") count += c;
      const w = getWikiCount(db);
      if (typeof w === "number") wikiCount += w;
      const d = getLastLearnedDate(db);
      if (d && (!lastDate || d > lastDate)) lastDate = d;
      const wd = getLastWikiPullDate(db);
      if (wd && (!lastWikiDate || wd > lastWikiDate)) lastWikiDate = wd;
    } finally {
      db.close();
    }
  }

  const helpedToday = countEventsSince(eventsDb, HELPED_EVENT_KINDS, sinceIso(0));
  const helpedWeek = countEventsSince(eventsDb, HELPED_EVENT_KINDS, sinceIso(7));
  const riskToday = countEventsSince(eventsDb, RISK_EVENT_KINDS, sinceIso(0));
  const hint = getLatestContributionHint(eventsDb) ?? "护航中";

  if (eventsDb) eventsDb.close();

  process.stdout.write(
    `TeamAgent · rules:${formatMetric(count)} · helped:${formatMetric(helpedToday)}/${formatMetric(helpedWeek)} · risk:${formatMetric(riskToday)} · ${hint}`,
  );
}

main();
