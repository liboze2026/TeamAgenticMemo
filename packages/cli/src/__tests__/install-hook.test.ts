import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { installHook, uninstallHook } from "../commands/install-hook.js";

function mkTmp(): { cwd: string; cleanup: () => void } {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "install-hook-"));
  return {
    cwd,
    cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }),
  };
}

// 用真实存在的文件作 fake hook entry，绕过"bundle 必须存在"的检查
const FAKE_HOOK_ENTRY = fileURLToPath(import.meta.url);

describe("installHook", () => {
  let tmp: ReturnType<typeof mkTmp>;

  beforeEach(() => {
    tmp = mkTmp();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("creates settings.local.json with PreToolUse hook entry", () => {
    const r = installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY });
    expect(r.alreadyInstalled).toBe(false);

    const content = JSON.parse(fs.readFileSync(r.settingsPath, "utf-8"));
    expect(content.hooks.PreToolUse).toBeDefined();
    expect(content.hooks.PreToolUse[0]._teamagentTag).toBe("teamagent-pre-tool-use");
    expect(content.hooks.PreToolUse[0].matcher).toContain("Bash");
    expect(content.hooks.PreToolUse[0].hooks[0].command).toContain("node");
    // command 会把反斜杠转为正斜杠
    const forwardEntry = FAKE_HOOK_ENTRY.replace(/\\/g, "/");
    expect(content.hooks.PreToolUse[0].hooks[0].command).toContain(forwardEntry);
  });

  it("preserves existing user settings", () => {
    const settingsPath = path.join(tmp.cwd, ".claude", "settings.local.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        someUserSetting: "preserved",
        hooks: {
          PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "user-hook.sh" }] }],
        },
      }),
    );

    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY });

    const content = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(content.someUserSetting).toBe("preserved");
    expect(content.hooks.PreToolUse).toHaveLength(2);
    expect(content.hooks.PreToolUse[0].hooks[0].command).toBe("user-hook.sh");
    expect(content.hooks.PreToolUse[1]._teamagentTag).toBe("teamagent-pre-tool-use");
  });

  it("idempotent: second install detects already-installed", () => {
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY });
    const r2 = installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY });
    expect(r2.alreadyInstalled).toBe(true);

    const content = JSON.parse(
      fs.readFileSync(r2.settingsPath, "utf-8"),
    );
    expect(content.hooks.PreToolUse).toHaveLength(1);
  });
});

describe("uninstallHook", () => {
  let tmp: ReturnType<typeof mkTmp>;

  beforeEach(() => {
    tmp = mkTmp();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("returns removed=false when settings file missing", () => {
    const r = uninstallHook({ cwd: tmp.cwd });
    expect(r.removed).toBe(false);
  });

  it("removes only TeamAgent entry, preserves user hooks", () => {
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY });

    // 注入一条用户自己的 hook
    const settingsPath = path.join(tmp.cwd, ".claude", "settings.local.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    settings.hooks.PreToolUse.push({
      matcher: "Read",
      hooks: [{ type: "command", command: "user-other.sh" }],
    });
    fs.writeFileSync(settingsPath, JSON.stringify(settings));

    const r = uninstallHook({ cwd: tmp.cwd });
    expect(r.removed).toBe(true);

    const after = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(after.hooks.PreToolUse).toHaveLength(1);
    expect(after.hooks.PreToolUse[0].hooks[0].command).toBe("user-other.sh");
  });

  it("returns removed=false on second uninstall", () => {
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY });
    uninstallHook({ cwd: tmp.cwd });
    const r2 = uninstallHook({ cwd: tmp.cwd });
    expect(r2.removed).toBe(false);
  });
});

describe("installHook — UserPromptSubmit + Stop", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => { tmp = mkTmp(); });
  afterEach(() => { tmp.cleanup(); });

  it("registers UserPromptSubmit hook when bundle provided", () => {
    installHook({
      cwd: tmp.cwd,
      hookEntry: FAKE_HOOK_ENTRY,
      userPromptEntry: FAKE_HOOK_ENTRY,
    });
    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8")
    );
    expect(content.hooks.UserPromptSubmit).toBeDefined();
    expect(content.hooks.UserPromptSubmit[0]._teamagentTag).toBe("teamagent-user-prompt-submit");
    expect(content.hooks.UserPromptSubmit[0].hooks[0].timeout).toBe(10);
    expect(content.hooks.UserPromptSubmit[0].matcher).toBeUndefined();
  });

  it("registers Stop hook when bundle provided", () => {
    installHook({
      cwd: tmp.cwd,
      hookEntry: FAKE_HOOK_ENTRY,
      stopEntry: FAKE_HOOK_ENTRY,
    });
    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8")
    );
    expect(content.hooks.Stop).toBeDefined();
    expect(content.hooks.Stop[0]._teamagentTag).toBe("teamagent-stop");
    expect(content.hooks.Stop[0].hooks[0].timeout).toBe(60);
    expect(content.hooks.Stop[0].matcher).toBeUndefined();
  });

  it("idempotent: second install of UserPromptSubmit not duplicated", () => {
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY, userPromptEntry: FAKE_HOOK_ENTRY });
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY, userPromptEntry: FAKE_HOOK_ENTRY });
    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8")
    );
    expect(content.hooks.UserPromptSubmit).toHaveLength(1);
  });

  it("uninstall removes UserPromptSubmit and Stop entries", () => {
    installHook({
      cwd: tmp.cwd,
      hookEntry: FAKE_HOOK_ENTRY,
      userPromptEntry: FAKE_HOOK_ENTRY,
      stopEntry: FAKE_HOOK_ENTRY,
    });
    uninstallHook({ cwd: tmp.cwd });
    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8")
    );
    expect(content.hooks?.UserPromptSubmit).toBeUndefined();
    expect(content.hooks?.Stop).toBeUndefined();
  });
});

describe("installHook — statusLine", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => { tmp = mkTmp(); });
  afterEach(() => { tmp.cleanup(); });

  it("registers teamagent statusLine when none exists", () => {
    const r = installHook({
      cwd: tmp.cwd,
      hookEntry: FAKE_HOOK_ENTRY,
      statusLineEntry: FAKE_HOOK_ENTRY,
    });
    expect(r.statusLineSkipped).toBe(false);

    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8"),
    );
    expect(content.statusLine).toBeDefined();
    expect(content.statusLine.type).toBe("command");
    expect(content.statusLine._teamagentTag).toBe("teamagent-statusline");
    expect(content.statusLine.command).toContain("node");
    expect(content.statusLine.command).toContain(FAKE_HOOK_ENTRY.replace(/\\/g, "/"));
  });

  it("updates tagged teamagent statusLine (idempotent)", () => {
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY, statusLineEntry: FAKE_HOOK_ENTRY });
    const r2 = installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY, statusLineEntry: FAKE_HOOK_ENTRY });
    expect(r2.statusLineSkipped).toBe(false);

    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8"),
    );
    expect(content.statusLine._teamagentTag).toBe("teamagent-statusline");
  });

  it("does not overwrite user's non-teamagent statusLine", () => {
    const settingsPath = path.join(tmp.cwd, ".claude", "settings.local.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    const preExisting = {
      statusLine: {
        type: "command",
        command: "node /custom/user/bar.js",
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(preExisting));

    const r = installHook({
      cwd: tmp.cwd,
      hookEntry: FAKE_HOOK_ENTRY,
      statusLineEntry: FAKE_HOOK_ENTRY,
    });
    expect(r.statusLineSkipped).toBe(true);

    const content = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(content.statusLine.command).toBe("node /custom/user/bar.js");
    expect(content.statusLine._teamagentTag).toBeUndefined();
  });

  it("uninstall removes only tagged teamagent statusLine", () => {
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY, statusLineEntry: FAKE_HOOK_ENTRY });
    uninstallHook({ cwd: tmp.cwd });
    const content = JSON.parse(
      fs.readFileSync(path.join(tmp.cwd, ".claude", "settings.local.json"), "utf-8"),
    );
    expect(content.statusLine).toBeUndefined();
  });

  it("uninstall preserves user's non-teamagent statusLine", () => {
    const settingsPath = path.join(tmp.cwd, ".claude", "settings.local.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        statusLine: { type: "command", command: "user-status.sh" },
      }),
    );
    installHook({ cwd: tmp.cwd, hookEntry: FAKE_HOOK_ENTRY, statusLineEntry: FAKE_HOOK_ENTRY });
    uninstallHook({ cwd: tmp.cwd });
    const content = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(content.statusLine.command).toBe("user-status.sh");
  });
});
