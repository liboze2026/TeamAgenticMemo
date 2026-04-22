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
const PROJECT_DB = path.resolve(process.cwd(), ".teamagent/knowledge.db");
const GLOBAL_DB = path.join(os.homedir(), ".teamagent", "global.db");
const GLOBAL_EVENTS_DB = path.join(os.homedir(), ".teamagent", "events.db");

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

function getTodayBlockCount(db) {
  try {
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM events WHERE kind LIKE 'hook-pre.blocked%' AND date(timestamp) = date('now')"
      )
      .get();
    return row ? row.n : 0;
  } catch {
    try {
      const row2 = db
        .prepare(
          "SELECT COUNT(*) AS n FROM events WHERE event_type LIKE 'hook-pre.blocked%' AND date(created_at) = date('now')"
        )
        .get();
      return row2 ? row2.n : 0;
    } catch {
      return null;
    }
  }
}

function getTodayPassCount(db) {
  try {
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM events WHERE kind = 'hook-pre.passed' AND date(timestamp) = date('now')"
      )
      .get();
    return row ? row.n : 0;
  } catch {
    return null;
  }
}

function main() {
  const projectDb = tryOpenDb(PROJECT_DB);
  const globalDb  = tryOpenDb(GLOBAL_DB);

  if (!projectDb && !globalDb) {
    process.stdout.write("TeamAgent正在运行 · (未初始化)");
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

  const eventsDb = tryOpenDb(GLOBAL_EVENTS_DB);
  let todayBlocks = null;
  let todayPassed = null;
  if (eventsDb) {
    try {
      todayBlocks = getTodayBlockCount(eventsDb);
      todayPassed = getTodayPassCount(eventsDb);
    } finally {
      eventsDb.close();
    }
  }

  const parts = ["TeamAgent正在运行"];
  parts.push(`规则库：${count !== null ? count : "-"}条`);
  parts.push(`wiki：${wikiCount}条${lastWikiDate ? ` (${lastWikiDate})` : ""}`);
  parts.push(todayBlocks !== null ? `今日已拦截：${todayBlocks}` : "今日已拦截：-");
  parts.push(todayPassed !== null ? `今日放行：${todayPassed}` : "今日放行：-");
  if (lastDate) parts.push(`最近全局解析：${lastDate}`);

  process.stdout.write(parts.join(" · "));
}

main();
