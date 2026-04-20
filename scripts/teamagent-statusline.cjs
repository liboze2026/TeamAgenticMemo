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

const PROJECT_DB = path.resolve(__dirname, "../.teamagent/knowledge.db");
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
    const row = db.prepare("SELECT COUNT(*) AS n FROM knowledge WHERE status = 'active'").get();
    return row ? row.n : null;
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
  const knowledgeDb = tryOpenDb(PROJECT_DB);

  if (!knowledgeDb) {
    process.stdout.write("TeamAgent正在运行 · (未初始化)");
    return;
  }

  let count, lastDate;
  try {
    count = getEntryCount(knowledgeDb);
    lastDate = getLastLearnedDate(knowledgeDb);
  } finally {
    knowledgeDb.close();
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
  parts.push(`规则库现有：${count !== null ? count : "-"}条`);
  parts.push(todayBlocks !== null ? `今日已拦截：${todayBlocks}` : "今日已拦截：-");
  parts.push(todayPassed !== null ? `今日放行：${todayPassed}` : "今日放行：-");
  if (lastDate) parts.push(`系统最近解析规则时间：${lastDate}`);

  process.stdout.write(parts.join(" · "));
}

main();
