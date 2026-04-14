import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeDemoHook, parseDemoHookArgs } from "../commands/demo-hook.js";
import { executePitfall } from "../commands/pitfall.js";

function mkTmp() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "demo-cwd-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "demo-home-"));
  return {
    cwd,
    home,
    cleanup: () => {
      fs.rmSync(cwd, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    },
  };
}

describe("parseDemoHookArgs", () => {
  it("returns null for empty args", () => {
    expect(parseDemoHookArgs([])).toBeNull();
  });

  it("parses tool name + key=value args", () => {
    const out = parseDemoHookArgs(["Bash", "command=npm install moment"]);
    expect(out).toEqual({
      toolName: "Bash",
      toolInput: { command: "npm install moment" },
    });
  });

  it("parses JSON-valued args", () => {
    const out = parseDemoHookArgs([
      "WebFetch",
      'url="https://x.com"',
      "prompt=fetch",
    ]);
    expect(out?.toolInput.url).toBe("https://x.com");
  });
});

describe("executeDemoHook", () => {
  let tmp: ReturnType<typeof mkTmp>;
  const fixedNow = "2026-04-14T00:00:00Z";

  beforeEach(() => {
    tmp = mkTmp();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("no rules → '通过 (无规则命中)'", () => {
    const out = executeDemoHook({
      toolName: "Bash",
      toolInput: { command: "ls" },
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => fixedNow,
    });
    expect(out).toContain("通过 (无规则命中)");
    expect(out).toContain("🟢");
  });

  it("warn-level match → 💡 + AI 提示", () => {
    executePitfall(
      {
        trigger: "npm install moment",
        wrong: "moment",
        correct: "dayjs",
        reason: "已停止维护",
        nature: "subjective", // 强制 warn (cap)
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );

    const out = executeDemoHook({
      toolName: "Bash",
      toolInput: { command: "npm install moment" },
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => fixedNow,
    });

    expect(out).toContain("💡");
    expect(out).toContain("决策: allow");
    expect(out).toContain("dayjs");
  });

  it("block-level match → 🚫 + 拦截原因", () => {
    // 直接 seed 一个 block 规则（pitfall 默认 confidence=0.7 出 warn；这里手动）
    // 借用 pitfall 但 nature=objective + 后续 confidence high 才 block
    // 简化：手写到 personal store
    const personalPath = path.join(tmp.home, ".teamagent", "personal", "knowledge.jsonl");
    fs.mkdirSync(path.dirname(personalPath), { recursive: true });
    const entry = {
      id: "block-test",
      scope: { level: "personal" },
      category: "C",
      tags: ["danger"],
      type: "avoidance",
      nature: "objective",
      trigger: "rm -rf",
      wrong_pattern: "rm -rf /",
      correct_pattern: "git clean -fd 或具体路径",
      reasoning: "rm -rf 不可逆",
      confidence: 0.95,
      enforcement: "block",
      status: "active",
      hit_count: 0,
      success_count: 0,
      override_count: 0,
      evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
      created_at: fixedNow,
      last_hit_at: "",
      last_validated_at: fixedNow,
      source: "accumulated",
      conflict_with: [],
    };
    fs.writeFileSync(personalPath, JSON.stringify(entry) + "\n");

    const out = executeDemoHook({
      toolName: "Bash",
      toolInput: { command: "rm -rf /important" },
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => fixedNow,
    });

    expect(out).toContain("🚫");
    expect(out).toContain("决策: deny");
    expect(out).toContain("git clean");
  });
});
