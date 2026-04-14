import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_TAG = "teamagent-pre-tool-use";

export interface InstallHookOptions {
  cwd?: string;
  /** 显式指定 hook 入口绝对路径 */
  hookEntry?: string;
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookEntry[];
    PostToolUse?: HookEntry[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
  /** TeamAgent 标签，用于卸载识别（自定义字段，settings.json 不要求）*/
  _teamagentTag?: string;
}

interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

function defaultHookEntry(): string {
  // 当前 bin-pre-tool-use.ts 的位置：packages/cli/src/bin-pre-tool-use.ts
  // 通过 import.meta.url 找到自身后回溯到项目根
  const here = fileURLToPath(import.meta.url);
  // here = .../packages/cli/src/commands/install-hook.ts
  // -> 退到 packages/cli/src/bin-pre-tool-use.ts
  const cliSrc = path.dirname(path.dirname(here));
  return path.join(cliSrc, "bin-pre-tool-use.ts");
}

function readSettings(file: string): ClaudeSettings {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as ClaudeSettings;
}

function writeSettings(file: string, settings: ClaudeSettings): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * 把 TeamAgent PreToolUse hook 注册到 .claude/settings.local.json。
 * 用 settings.local.json 而非 settings.json 是因为：
 * - settings.local.json 是用户机器本地配置（Claude Code 约定不入 git）
 * - 入 git 的话每次提交都会带上 hook 引用，跨开发者不一致
 *
 * 重复安装是幂等的。
 */
export function installHook(opts: InstallHookOptions = {}): {
  settingsPath: string;
  hookEntry: string;
  alreadyInstalled: boolean;
} {
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");
  const hookEntry = opts.hookEntry ?? defaultHookEntry();

  const settings = readSettings(settingsPath);
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

  const existing = settings.hooks.PreToolUse.find(
    (h) => h._teamagentTag === HOOK_TAG,
  );
  if (existing) {
    return { settingsPath, hookEntry, alreadyInstalled: true };
  }

  // 用 tsx 跑 .ts 文件——避免 Phase 1 的额外 build 步骤
  // M5 init 会编译为 .cjs 单文件提升启动速度
  const command = `npx tsx ${shellQuote(hookEntry)}`;

  settings.hooks.PreToolUse.push({
    matcher: "Bash|Write|Edit|WebFetch",
    _teamagentTag: HOOK_TAG,
    hooks: [{ type: "command", command, timeout: 30 }],
  });

  writeSettings(settingsPath, settings);
  return { settingsPath, hookEntry, alreadyInstalled: false };
}

/** 移除 TeamAgent hook 注册。返回是否实际移除了。 */
export function uninstallHook(opts: { cwd?: string } = {}): {
  settingsPath: string;
  removed: boolean;
} {
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");

  if (!fs.existsSync(settingsPath)) {
    return { settingsPath, removed: false };
  }

  const settings = readSettings(settingsPath);
  if (!settings.hooks?.PreToolUse) {
    return { settingsPath, removed: false };
  }

  const before = settings.hooks.PreToolUse.length;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
    (h) => h._teamagentTag !== HOOK_TAG,
  );
  const after = settings.hooks.PreToolUse.length;

  if (settings.hooks.PreToolUse.length === 0) {
    delete settings.hooks.PreToolUse;
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(settingsPath, settings);
  return { settingsPath, removed: before !== after };
}

function shellQuote(p: string): string {
  // 双引号包装 + 反斜杠转义内部引号；适用于 Windows + bash + Claude Code
  if (/^[A-Za-z0-9_./:\\-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}
