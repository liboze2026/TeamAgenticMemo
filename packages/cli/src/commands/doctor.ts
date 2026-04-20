// packages/cli/src/commands/doctor.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

export interface DoctorCheckResult {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
  fix?: string;
}

export interface DoctorResult {
  checks: DoctorCheckResult[];
  passed: number;
  failed: number;
  skipped: number;
  allPassed: boolean;
}

export interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
  postinstall?: boolean;
  cwd?: string;
  homeDir?: string;
}

export function parseDoctorArgs(argv: string[]): DoctorOptions {
  return {
    fix: argv.includes("--fix"),
    json: argv.includes("--json"),
    postinstall: argv.includes("--postinstall"),
  };
}

export async function executeDoctor(opts: DoctorOptions = {}): Promise<DoctorResult> {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.homeDir ?? os.homedir();
  const checks: DoctorCheckResult[] = [];

  // Check 1: Node.js version
  const nodeCheck = checkNodeVersion();
  checks.push(nodeCheck);
  if (nodeCheck.status === "fail") {
    return finalize(checks, true);
  }

  // Check 2: Claude Code installed
  const claudeCheck = checkClaudeCode();
  checks.push(claudeCheck);
  if (claudeCheck.status === "fail") {
    return finalize(checks, true);
  }

  // Check 3: sqlite-vec loadable
  checks.push(checkSqliteVec());

  // Check 4: ~/.teamagent/ writable
  const homeCheck = checkHomeDir(home);
  checks.push(homeCheck);
  if (homeCheck.status === "fail") {
    return finalize(checks, true);
  }

  // Check 5: knowledge.db exists
  const dbPath = path.join(cwd, ".teamagent", "knowledge.db");
  const dbCheck = checkKnowledgeDb(dbPath);
  checks.push(dbCheck);
  if (dbCheck.status === "fail") {
    // Skip remaining checks if DB missing
    checks.push(skip("hook-registered", "knowledge.db 先修"));
    checks.push(skip("hook-script", "knowledge.db 先修"));
    checks.push(skip("claude-md", "knowledge.db 先修"));
    return finalize(checks, false);
  }

  // Check 6: Hook registered
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");
  const hookCheck = checkHookRegistered(settingsPath);
  checks.push(hookCheck);
  if (hookCheck.status === "fail") {
    checks.push(skip("hook-script", "Hook 注册先修"));
    checks.push(skip("claude-md", "跳过"));
    return finalize(checks, false);
  }

  // Check 7: Hook script exists
  const hookScriptCheck = checkHookScript(settingsPath);
  checks.push(hookScriptCheck);

  // Check 8: CLAUDE.md has TeamAgent block
  const claudeMdPath = path.join(cwd, "CLAUDE.md");
  checks.push(checkClaudeMd(claudeMdPath));

  return finalize(checks, false);
}

function finalize(checks: DoctorCheckResult[], earlyExit: boolean): DoctorResult {
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const skipped = checks.filter((c) => c.status === "skip").length;
  return { checks, passed, failed, skipped, allPassed: failed === 0 && !earlyExit };
}

function skip(name: string, detail: string): DoctorCheckResult {
  return { name, status: "skip", detail };
}

function checkNodeVersion(): DoctorCheckResult {
  const raw = process.version; // e.g. "v22.4.0"
  const major = parseInt(raw.slice(1).split(".")[0] ?? "0", 10);
  if (major >= 22) {
    return { name: "node-version", status: "pass", detail: `${raw}  (需要 ≥ 22)` };
  }
  return {
    name: "node-version",
    status: "fail",
    detail: `${raw} (需要 ≥ 22)`,
    fix: "nvm install 22 && nvm use 22",
  };
}

function checkClaudeCode(): DoctorCheckResult {
  try {
    const out = execSync("claude --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    return { name: "claude-code", status: "pass", detail: out.split("\n")[0] ?? out };
  } catch {
    return {
      name: "claude-code",
      status: "fail",
      detail: "未找到 claude 命令",
      fix: "npm install -g @anthropic-ai/claude-code",
    };
  }
}

function checkSqliteVec(): DoctorCheckResult {
  try {
    _require("sqlite-vec");
    return { name: "sqlite-vec", status: "pass", detail: "加载成功" };
  } catch {
    return {
      name: "sqlite-vec",
      status: "fail",
      detail: "sqlite-vec 扩展加载失败",
      fix: "npm install -g sqlite-vec  （或检查平台是否支持）",
    };
  }
}

function checkHomeDir(home: string): DoctorCheckResult {
  const tDir = path.join(home, ".teamagent");
  try {
    fs.mkdirSync(tDir, { recursive: true });
    const probe = path.join(tDir, `.doctor-probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    return { name: "home-dir", status: "pass", detail: `${tDir} 可读写` };
  } catch (e) {
    return {
      name: "home-dir",
      status: "fail",
      detail: `~/.teamagent 不可写: ${String(e).slice(0, 80)}`,
      fix: `chmod 755 ${tDir}`,
    };
  }
}

function checkKnowledgeDb(dbPath: string): DoctorCheckResult {
  if (!fs.existsSync(dbPath)) {
    return {
      name: "knowledge-db",
      status: "fail",
      detail: "知识库未初始化",
      fix: "teamagent init",
    };
  }
  try {
    // Try opening it — will throw if corrupted
    const { openDb } = _require("@teamagent/adapters") as { openDb: (p: string) => { close(): void } };
    const db = openDb(dbPath);
    db.close();
    return { name: "knowledge-db", status: "pass", detail: dbPath };
  } catch {
    return {
      name: "knowledge-db",
      status: "fail",
      detail: "knowledge.db 无法打开（可能已损坏）",
      fix: "teamagent init  （将重建数据库）",
    };
  }
}

function checkHookRegistered(settingsPath: string): DoctorCheckResult {
  if (!fs.existsSync(settingsPath)) {
    return {
      name: "hook-registered",
      status: "fail",
      detail: ".claude/settings.local.json 不存在",
      fix: "teamagent install-hook",
    };
  }
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const hooks = settings["hooks"] as Record<string, unknown> | undefined;
    const pre = hooks?.["PreToolUse"] as unknown[] | undefined;
    const hasTeamAgent = Array.isArray(pre) &&
      pre.some((h: unknown) => (h as Record<string, unknown>)["_teamagentTag"] === "teamagent-pre-tool-use");
    if (hasTeamAgent) {
      return { name: "hook-registered", status: "pass", detail: "PreToolUse Hook 已注册" };
    }
    return {
      name: "hook-registered",
      status: "fail",
      detail: "settings.local.json 中未找到 TeamAgent hook",
      fix: "teamagent install-hook",
    };
  } catch {
    return {
      name: "hook-registered",
      status: "fail",
      detail: "无法解析 settings.local.json",
      fix: "teamagent install-hook",
    };
  }
}

function checkHookScript(settingsPath: string): DoctorCheckResult {
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const hooks = settings["hooks"] as Record<string, unknown> | undefined;
    const pre = hooks?.["PreToolUse"] as unknown[] | undefined;
    const entry = Array.isArray(pre)
      ? (pre.find((h: unknown) => (h as Record<string, unknown>)["_teamagentTag"] === "teamagent-pre-tool-use") as Record<string, unknown> | undefined)
      : undefined;
    const cmds = entry?.["hooks"] as Array<{ command: string }> | undefined;
    const cmd = cmds?.[0]?.command ?? "";
    // Extract file path from: node "path/to/script.cjs"
    const match = cmd.match(/node\s+"?([^"]+)"?/);
    const scriptPath = match?.[1];
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      return {
        name: "hook-script",
        status: "fail",
        detail: `Hook 脚本不存在: ${scriptPath ?? "(未找到路径)"}`,
        fix: "npm install -g teamagent  （重装）",
      };
    }
    return { name: "hook-script", status: "pass", detail: scriptPath };
  } catch {
    return {
      name: "hook-script",
      status: "fail",
      detail: "无法读取 hook 脚本路径",
      fix: "teamagent install-hook",
    };
  }
}

function checkClaudeMd(claudeMdPath: string): DoctorCheckResult {
  if (!fs.existsSync(claudeMdPath)) {
    return {
      name: "claude-md",
      status: "fail",
      detail: "CLAUDE.md 不存在",
      fix: "teamagent compile",
    };
  }
  const content = fs.readFileSync(claudeMdPath, "utf-8");
  if (content.includes("TEAMAGENT:START")) {
    return { name: "claude-md", status: "pass", detail: "TEAMAGENT 区块已存在" };
  }
  return {
    name: "claude-md",
    status: "fail",
    detail: "CLAUDE.md 中未找到 TEAMAGENT:START 标记",
    fix: "teamagent compile",
  };
}

const CHECK_LABELS: Record<string, string> = {
  "node-version":    "Node.js     ",
  "claude-code":     "Claude Code ",
  "sqlite-vec":      "sqlite-vec  ",
  "home-dir":        "~/.teamagent",
  "knowledge-db":    "knowledge.db",
  "hook-registered": "Hook 注册   ",
  "hook-script":     "Hook 脚本   ",
  "claude-md":       "CLAUDE.md   ",
};

export function renderDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push("环境诊断 / Environment Check");
  lines.push("─".repeat(40));

  for (const check of result.checks) {
    const label = CHECK_LABELS[check.name] ?? check.name.padEnd(12);
    if (check.status === "pass") {
      lines.push(`✅ ${check.name} (${label})  ${check.detail}`);
    } else if (check.status === "fail") {
      lines.push(`❌ ${check.name} (${label})  ${check.detail}`);
      if (check.fix) {
        lines.push(`   → 运行: ${check.fix}`);
      }
    } else {
      lines.push(`⏭  ${check.name} (${label})  (${check.detail})`);
    }
  }

  lines.push("");
  if (result.allPassed) {
    lines.push("✅ 全部检查通过！TeamAgent 运行正常。");
  } else {
    const parts: string[] = [];
    if (result.failed > 0) parts.push(`${result.failed} 项失败`);
    if (result.skipped > 0) parts.push(`${result.skipped} 项跳过`);
    lines.push(`${parts.join("，")}。修复后重跑 teamagent doctor`);
  }

  return lines.join("\n") + "\n";
}
