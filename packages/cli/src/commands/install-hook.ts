import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_TAG = "teamagent-pre-tool-use";
const POST_HOOK_TAG = "teamagent-post-tool-use";
const USER_PROMPT_TAG = "teamagent-user-prompt-submit";
const STOP_HOOK_TAG   = "teamagent-stop";
const STATUS_LINE_TAG = "teamagent-statusline";

export interface InstallHookOptions {
  cwd?: string;
  /** 显式指定 PreToolUse hook 入口绝对路径 */
  hookEntry?: string;
  /** 显式指定 PostToolUse hook 入口绝对路径 */
  postHookEntry?: string;
  /** 显式指定 UserPromptSubmit hook 入口绝对路径 */
  userPromptEntry?: string;
  /** 显式指定 Stop hook 入口绝对路径 */
  stopEntry?: string;
  /** 显式指定 statusLine 脚本入口绝对路径 */
  statusLineEntry?: string;
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookEntry[];
    PostToolUse?: HookEntry[];
    UserPromptSubmit?: HookEntry[];
    Stop?: HookEntry[];
    [k: string]: unknown;
  };
  statusLine?: {
    type?: string;
    command?: string;
    _teamagentTag?: string;
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
  // 从当前文件位置向上走，找到包含 dist/bin-pre-tool-use.cjs 的目录。
  // - Dev (source, tsx):  .../packages/cli/src/commands/install-hook.ts
  //                       → .../packages/cli/
  // - Bundled (npm):      .../node_modules/teamagent/dist/bin.js
  //                       → .../node_modules/teamagent/
  // 旧实现硬编码"退 3 层"，在 bundle 模式退到 node_modules/，
  // 再拼 "dist/bin-stop.cjs" 得到 node_modules/dist/bin-stop.cjs（不存在）。
  const here = fileURLToPath(import.meta.url);
  let dir = path.dirname(here);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "dist", "bin-pre-tool-use.cjs"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 兜底：bundle 时总是 dist/bin.js → 上一级就是包根
  return path.dirname(path.dirname(here));
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
 * `C:\path\to\repo` → `C:/path/to/repo`
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
  /** true = 已有非 teamagent 的 statusLine，按约定保留未覆盖 */
  statusLineSkipped: boolean;
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

  // UserPromptSubmit 注册
  const userPromptEntry = opts.userPromptEntry
    ?? path.join(cliRoot(), "dist", "bin-user-prompt-submit.cjs");
  const hasUserPromptBundle = fs.existsSync(userPromptEntry);
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  if (hasUserPromptBundle) {
    const upExisting = settings.hooks.UserPromptSubmit.find(
      (h) => h._teamagentTag === USER_PROMPT_TAG,
    );
    if (!upExisting) {
      settings.hooks.UserPromptSubmit.push({
        _teamagentTag: USER_PROMPT_TAG,
        hooks: [{ type: "command", command: `node ${shellQuote(toForwardSlash(userPromptEntry))}`, timeout: 10 }],
      });
    }
  }
  if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;

  // Stop 注册
  const stopEntry = opts.stopEntry
    ?? path.join(cliRoot(), "dist", "bin-stop.cjs");
  const hasStopBundle = fs.existsSync(stopEntry);
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  if (hasStopBundle) {
    const stopExisting = settings.hooks.Stop.find(
      (h) => h._teamagentTag === STOP_HOOK_TAG,
    );
    if (!stopExisting) {
      settings.hooks.Stop.push({
        _teamagentTag: STOP_HOOK_TAG,
        hooks: [{ type: "command", command: `node ${shellQuote(toForwardSlash(stopEntry))}`, timeout: 60 }],
      });
    }
  }
  if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;

  // statusLine 注册。CC 只有一个 statusLine 槽位 — 若用户已有非 teamagent 的
  // statusLine（例如 caveman），不覆盖，标记 skipped=true 让调用方打提示。
  // 旧 teamagent 的（有 _teamagentTag）视作可更新。
  const statusLineEntry = opts.statusLineEntry
    ?? path.join(cliRoot(), "dist", "teamagent-statusline.cjs");
  const hasStatusLineBundle = fs.existsSync(statusLineEntry);
  let statusLineSkipped = false;
  if (hasStatusLineBundle) {
    const existing = settings.statusLine;
    const isOurs =
      !existing ||
      Object.keys(existing).length === 0 ||
      existing._teamagentTag === STATUS_LINE_TAG;
    if (isOurs) {
      settings.statusLine = {
        type: "command",
        command: `node ${shellQuote(toForwardSlash(statusLineEntry))}`,
        _teamagentTag: STATUS_LINE_TAG,
      };
    } else {
      statusLineSkipped = true;
    }
  }

  writeSettings(settingsPath, settings);
  return {
    settingsPath,
    hookEntry,
    postHookEntry,
    alreadyInstalled,
    postAlreadyInstalled,
    statusLineSkipped,
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

  if (settings.hooks.UserPromptSubmit) {
    const before = settings.hooks.UserPromptSubmit.length;
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      (h) => h._teamagentTag !== USER_PROMPT_TAG,
    );
    if (settings.hooks.UserPromptSubmit.length !== before) removedAny = true;
    if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;
  }

  if (settings.hooks.Stop) {
    const before = settings.hooks.Stop.length;
    settings.hooks.Stop = settings.hooks.Stop.filter(
      (h) => h._teamagentTag !== STOP_HOOK_TAG,
    );
    if (settings.hooks.Stop.length !== before) removedAny = true;
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  }

  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  // statusLine：只有在明确打了 teamagent tag 时才移除，避免误删用户的
  if (settings.statusLine?._teamagentTag === STATUS_LINE_TAG) {
    delete settings.statusLine;
    removedAny = true;
  }

  writeSettings(settingsPath, settings);
  return { settingsPath, removed: removedAny };
}

function shellQuote(p: string): string {
  // 双引号包装 + 反斜杠转义内部引号；适用于 Windows + bash + Claude Code
  if (/^[A-Za-z0-9_./:\\-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}
