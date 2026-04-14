import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installHook, uninstallHook } from "../commands/install-hook.js";

function mkTmp(): { cwd: string; cleanup: () => void } {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "install-hook-"));
  return {
    cwd,
    cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }),
  };
}

const FAKE_HOOK_ENTRY = "/fake/hook-entry.ts";

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
    expect(content.hooks.PreToolUse[0].hooks[0].command).toContain("tsx");
    expect(content.hooks.PreToolUse[0].hooks[0].command).toContain(FAKE_HOOK_ENTRY);
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
