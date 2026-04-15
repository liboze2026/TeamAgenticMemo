import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_TAG = "teamagent-pre-tool-use";
const POST_HOOK_TAG = "teamagent-post-tool-use";

export interface InstallHookOptions {
  cwd?: string;
  /** 显式指定 PreToolUse hook 入口绝对路径 */
  hookEntry?: string;
  /** 显式指定 PostToolUse hook 入口绝对路径 */
  postHookEntry?: string;
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

function cliRoot(): string {
  // 通过 import.meta.url 找到 install-hook.ts 自身位置
  // → 退到 packages/cli/
  const here = fileURLToPath(import.meta.url);
  return path.dirname(path.dirname(path.dirname(here)));
}

function defaultHookEntry(): string {
  return path.join(cliRoot(), "dist", "bin-pre-tool-use.cjs");
}

function defaultPostHookEntry(): string {
  return path.join(cliRoot(), "dist", "bin-post-tool-use.cjs");
}

/**
 * 把 Windows 反斜杠路径转为正斜杠格式。
 * Git Bash 会吞掉路径里的反斜杠（视为转义），所以 hook command 必须用 /。
 * `C:\bzli\foo` → `C:/bzli/foo`
 */
function toForwardSlash(p: string): string {
  return p.replace(/\\/g, "/");
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
  postHookEntry: string;
  alreadyInstalled: boolean;
  postAlreadyInstalled: boolean;
} {
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");
  const hookEntry = opts.hookEntry ?? defaultHookEntry();
  const postHookEntry = opts.postHookEntry ?? defaultPostHookEntry();

  // 确认 PreToolUse bundled .cjs 存在
  if (!fs.existsSync(hookEntry)) {
    throw new Error(
      `Hook bundle not found: ${hookEntry}\n` +
        `请先运行: pnpm --filter @teamagent/cli build:hook`,
    );
  }
  // PostToolUse bundle 是软依赖——不存在时给警告但不阻断（兼容老安装）
  const hasPostBundle = fs.existsSync(postHookEntry);

  const settings = readSettings(settingsPath);
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  // PreToolUse 注册
  const preExisting = settings.hooks.PreToolUse.find(
    (h) => h._teamagentTag === HOOK_TAG,
  );
  let alreadyInstalled = false;
  if (preExisting) {
    alreadyInstalled = true;
  } else {
    const forwardPath = toForwardSlash(hookEntry);
    settings.hooks.PreToolUse.push({
      matcher: "Bash|Write|Edit|WebFetch",
      _teamagentTag: HOOK_TAG,
      hooks: [
        { type: "command", command: `node ${shellQuote(forwardPath)}`, timeout: 30 },
      ],
    });
  }

  // PostToolUse 注册（仅 bundle 存在时）
  let postAlreadyInstalled = false;
  if (hasPostBundle) {
    const postExisting = settings.hooks.PostToolUse.find(
      (h) => h._teamagentTag === POST_HOOK_TAG,
    );
    if (postExisting) {
      postAlreadyInstalled = true;
    } else {
      const forwardPath = toForwardSlash(postHookEntry);
      settings.hooks.PostToolUse.push({
        matcher: "Bash|Write|Edit|WebFetch",
        _teamagentTag: POST_HOOK_TAG,
        hooks: [
          { type: "command", command: `node ${shellQuote(forwardPath)}`, timeout: 30 },
        ],
      });
    }
  }

  // 清理空数组
  if (settings.hooks.PostToolUse?.length === 0) delete settings.hooks.PostToolUse;
  if (settings.hooks.PreToolUse?.length === 0) delete settings.hooks.PreToolUse;

  writeSettings(settingsPath, settings);
  return {
    settingsPath,
    hookEntry,
    postHookEntry,
    alreadyInstalled,
    postAlreadyInstalled,
  };
}

/** 移除 TeamAgent hook 注册（PreToolUse + PostToolUse 一并）。 */
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
  if (!settings.hooks) {
    return { settingsPath, removed: false };
  }

  let removedAny = false;

  if (settings.hooks.PreToolUse) {
    const before = settings.hooks.PreToolUse.length;
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
      (h) => h._teamagentTag !== HOOK_TAG,
    );
    if (settings.hooks.PreToolUse.length !== before) removedAny = true;
    if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
  }

  if (settings.hooks.PostToolUse) {
    const before = settings.hooks.PostToolUse.length;
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
      (h) => h._teamagentTag !== POST_HOOK_TAG,
    );
    if (settings.hooks.PostToolUse.length !== before) removedAny = true;
    if (settings.hooks.PostToolUse.length === 0) delete settings.hooks.PostToolUse;
  }

  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(settingsPath, settings);
  return { settingsPath, removed: removedAny };
}

function shellQuote(p: string): string {
  // 双引号包装 + 反斜杠转义内部引号；适用于 Windows + bash + Claude Code
  if (/^[A-Za-z0-9_./:\\-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}
