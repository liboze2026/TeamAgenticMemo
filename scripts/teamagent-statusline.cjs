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

function main() {
  // 未 init 且像项目 → 显眼提醒 (此路径在 --dangerously-skip-permissions 下也触发,
  // 因为 statusline 不经过 hook 系统)
  if (!hasProjectDb() && isProjectDir(process.cwd())) {
    process.stdout.write("⚠️  TeamAgent 未初始化本项目 · 运行 `teamagent init` 启用");
    return;
  }

  const projectDb = tryOpenDb(PROJECT_DB);
  const globalDb  = tryOpenDb(GLOBAL_DB);

  if (!projectDb && !globalDb) {
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

  const parts = ["TeamAgent正在运行"];
  parts.push(`规则库：${count !== null ? count : "-"}条`);
  parts.push(`wiki：${wikiCount}条${lastWikiDate ? ` (${lastWikiDate})` : ""}`);
  if (lastDate) parts.push(`最近全局解析：${lastDate}`);

  process.stdout.write(parts.join(" · "));
}

main();
