#!/usr/bin/env node
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(pkgDir, "dist", "bin.js");
const seedPath = path.join(pkgDir, "dist", "seed", "rules.jsonl");

function seedRuleCount() {
  try {
    if (!fs.existsSync(seedPath)) return 0;
    const text = fs.readFileSync(seedPath, "utf-8");
    return text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

// Run doctor to capture deeper issues but do NOT gate the welcome banner on it —
// knowledge.db + claude-md failures are expected before `teamagent init`.
let doctorFailed = false;
try {
  execSync(`node "${binPath}" doctor --postinstall`, {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
  });
} catch {
  doctorFailed = true;
}

// Auto-register user-level SessionStart hook so any future project auto-inits
// on first Claude Code open. Non-fatal on failure (user can run manually).
let userHookStatus = "skipped";
try {
  execSync(`node "${binPath}" install-user-hook`, {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
  });
  userHookStatus = "registered";
} catch {
  userHookStatus = "failed";
}

const n = seedRuleCount();
const ruleMsg = n > 0 ? `${n} 条打包规则已就绪` : "无打包规则";
const userHookMsg =
  userHookStatus === "registered"
    ? "用户级 SessionStart hook 已注册 (新项目自动 init)"
    : userHookStatus === "failed"
      ? "用户级 hook 注册失败, 请手动跑 teamagent install-user-hook"
      : "用户级 hook 未注册";

process.stdout.write(
  [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "✨ TeamAgent 安装成功",
    `   · 归因渲染: verbose 模式 (TEAMAGENT_VISIBILITY=smart 可调)`,
    `   · 知识种子: ${ruleMsg}`,
    `   · 自动初始化: ${userHookMsg}`,
    "   · 下一步  : 直接打开 Claude Code, 任何项目首次开会自动 init",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ].join("\n"),
);

if (doctorFailed) {
  process.stderr.write(
    "ℹ️  TeamAgent doctor 有未通过项 (通常是 knowledge.db 未初始化，属正常)。\n" +
      "   运行 `teamagent doctor` 查看详情\n\n",
  );
}
