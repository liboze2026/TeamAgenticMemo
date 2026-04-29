import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/install-hook.ts
init_esm_shims();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var HOOK_TAG = "teamagent-pre-tool-use";
var POST_HOOK_TAG = "teamagent-post-tool-use";
var USER_PROMPT_TAG = "teamagent-user-prompt-submit";
var STOP_HOOK_TAG = "teamagent-stop";
var STATUS_LINE_TAG = "teamagent-statusline";
function cliRoot() {
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
  return path.dirname(path.dirname(here));
}
function defaultHookEntry() {
  return path.join(cliRoot(), "dist", "bin-pre-tool-use.cjs");
}
function defaultPostHookEntry() {
  return path.join(cliRoot(), "dist", "bin-post-tool-use.cjs");
}
function toForwardSlash(p) {
  return p.replace(/\\/g, "/");
}
function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
function writeSettings(file, settings) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}
function installHook(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");
  const hookEntry = opts.hookEntry ?? defaultHookEntry();
  const postHookEntry = opts.postHookEntry ?? defaultPostHookEntry();
  if (!fs.existsSync(hookEntry)) {
    throw new Error(
      `Hook bundle not found: ${hookEntry}
\u8BF7\u5148\u8FD0\u884C: pnpm --filter @teamagent/cli build:hook`
    );
  }
  const hasPostBundle = fs.existsSync(postHookEntry);
  const settings = readSettings(settingsPath);
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
  const preExisting = settings.hooks.PreToolUse.find(
    (h) => h._teamagentTag === HOOK_TAG
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
        { type: "command", command: `node ${shellQuote(forwardPath)}`, timeout: 30 }
      ]
    });
  }
  let postAlreadyInstalled = false;
  if (hasPostBundle) {
    const postExisting = settings.hooks.PostToolUse.find(
      (h) => h._teamagentTag === POST_HOOK_TAG
    );
    if (postExisting) {
      postAlreadyInstalled = true;
    } else {
      const forwardPath = toForwardSlash(postHookEntry);
      settings.hooks.PostToolUse.push({
        matcher: "Bash|Write|Edit|WebFetch",
        _teamagentTag: POST_HOOK_TAG,
        hooks: [
          { type: "command", command: `node ${shellQuote(forwardPath)}`, timeout: 30 }
        ]
      });
    }
  }
  if (settings.hooks.PostToolUse?.length === 0) delete settings.hooks.PostToolUse;
  if (settings.hooks.PreToolUse?.length === 0) delete settings.hooks.PreToolUse;
  const userPromptEntry = opts.userPromptEntry ?? path.join(cliRoot(), "dist", "bin-user-prompt-submit.cjs");
  const hasUserPromptBundle = fs.existsSync(userPromptEntry);
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  if (hasUserPromptBundle) {
    const upExisting = settings.hooks.UserPromptSubmit.find(
      (h) => h._teamagentTag === USER_PROMPT_TAG
    );
    if (!upExisting) {
      settings.hooks.UserPromptSubmit.push({
        _teamagentTag: USER_PROMPT_TAG,
        hooks: [{ type: "command", command: `node ${shellQuote(toForwardSlash(userPromptEntry))}`, timeout: 10 }]
      });
    }
  }
  if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;
  const stopEntry = opts.stopEntry ?? path.join(cliRoot(), "dist", "bin-stop.cjs");
  const hasStopBundle = fs.existsSync(stopEntry);
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  if (hasStopBundle) {
    const stopExisting = settings.hooks.Stop.find(
      (h) => h._teamagentTag === STOP_HOOK_TAG
    );
    if (!stopExisting) {
      settings.hooks.Stop.push({
        _teamagentTag: STOP_HOOK_TAG,
        hooks: [{ type: "command", command: `node ${shellQuote(toForwardSlash(stopEntry))}`, timeout: 60 }]
      });
    }
  }
  if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  const statusLineEntry = opts.statusLineEntry ?? path.join(cliRoot(), "dist", "teamagent-statusline.cjs");
  const hasStatusLineBundle = fs.existsSync(statusLineEntry);
  let statusLineSkipped = false;
  if (hasStatusLineBundle) {
    const existing = settings.statusLine;
    const isOurs = !existing || Object.keys(existing).length === 0 || existing._teamagentTag === STATUS_LINE_TAG;
    if (isOurs) {
      settings.statusLine = {
        type: "command",
        command: `node ${shellQuote(toForwardSlash(statusLineEntry))}`,
        _teamagentTag: STATUS_LINE_TAG
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
    statusLineSkipped
  };
}
function uninstallHook(opts = {}) {
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
      (h) => h._teamagentTag !== HOOK_TAG
    );
    if (settings.hooks.PreToolUse.length !== before) removedAny = true;
    if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
  }
  if (settings.hooks.PostToolUse) {
    const before = settings.hooks.PostToolUse.length;
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
      (h) => h._teamagentTag !== POST_HOOK_TAG
    );
    if (settings.hooks.PostToolUse.length !== before) removedAny = true;
    if (settings.hooks.PostToolUse.length === 0) delete settings.hooks.PostToolUse;
  }
  if (settings.hooks.UserPromptSubmit) {
    const before = settings.hooks.UserPromptSubmit.length;
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      (h) => h._teamagentTag !== USER_PROMPT_TAG
    );
    if (settings.hooks.UserPromptSubmit.length !== before) removedAny = true;
    if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;
  }
  if (settings.hooks.Stop) {
    const before = settings.hooks.Stop.length;
    settings.hooks.Stop = settings.hooks.Stop.filter(
      (h) => h._teamagentTag !== STOP_HOOK_TAG
    );
    if (settings.hooks.Stop.length !== before) removedAny = true;
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
  if (settings.statusLine?._teamagentTag === STATUS_LINE_TAG) {
    delete settings.statusLine;
    removedAny = true;
  }
  writeSettings(settingsPath, settings);
  return { settingsPath, removed: removedAny };
}
function shellQuote(p) {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}

export {
  installHook,
  uninstallHook
};
