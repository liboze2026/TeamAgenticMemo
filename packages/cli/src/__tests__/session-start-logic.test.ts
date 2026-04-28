import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideAction } from "../session-start-logic.js";

describe("decideAction", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "ss-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("无 .teamagent/knowledge.db + 非项目目录 → skip-not-a-project", () => {
    const action = decideAction(cwd, new Date());
    expect(action).toBe("skip-not-a-project");
  });

  it("无 db + 有 package.json → auto-init", () => {
    writeFileSync(join(cwd, "package.json"), "{}");
    expect(decideAction(cwd, new Date())).toBe("auto-init");
  });

  it("无 db + 有 .git → auto-init", () => {
    mkdirSync(join(cwd, ".git"), { recursive: true });
    expect(decideAction(cwd, new Date())).toBe("auto-init");
  });

  it("无 db + .teamagent/auto-init.disabled 存在 → skip-auto-init-disabled", () => {
    writeFileSync(join(cwd, "package.json"), "{}");
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "auto-init.disabled"), "");
    expect(decideAction(cwd, new Date())).toBe("skip-auto-init-disabled");
  });

  it("已存在 knowledge.db → skip-already-initialized", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "knowledge.db"), "");
    expect(decideAction(cwd, new Date())).toBe("skip-already-initialized");
  });
});
