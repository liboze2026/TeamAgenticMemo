#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

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
    // Schema: events table has 'kind' and 'timestamp' columns
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM events WHERE kind LIKE 'hook-pre.blocked%' AND date(timestamp) = date('now')"
      )
      .get();
    return row ? row.n : 0;
  } catch {
    try {
      // Fallback: try legacy column names
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

function main() {
  const knowledgeDb = tryOpenDb(PROJECT_DB);

  if (!knowledgeDb) {
    process.stdout.write("✦ TeamAgent · (未初始化)");
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
  if (eventsDb) {
    try {
      todayBlocks = getTodayBlockCount(eventsDb);
    } finally {
      eventsDb.close();
    }
  }

  const parts = ["✦ TeamAgent"];
  parts.push(count !== null ? `${count}条` : "-条");
  if (todayBlocks !== null) parts.push(`拦截${todayBlocks}今日`);
  if (lastDate) parts.push(`上次${lastDate}`);

  process.stdout.write(parts.join(" · "));
}

main();
