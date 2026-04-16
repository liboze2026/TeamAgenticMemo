import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executePitfall, parsePitfallArgs } from "../commands/pitfall.js";
import { DualLayerStore, openDb } from "@teamagent/adapters";

function mkTmp(): { cwd: string; home: string; cleanup: () => void } {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pitfall-cwd-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pitfall-home-"));
  return {
    cwd,
    home,
    cleanup: () => {
      fs.rmSync(cwd, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    },
  };
}

describe("executePitfall", () => {
  let tmp: ReturnType<typeof mkTmp>;
  const fixedNow = "2026-04-14T10:00:00Z";

  beforeEach(() => {
    tmp = mkTmp();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("writes a new entry to personal knowledge store (project DB)", () => {
    executePitfall(
      {
        trigger: "npm install moment",
        wrong: "moment",
        correct: "dayjs",
        reason: "moment 已停止维护",
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );

    const dbPath = path.join(tmp.cwd, ".teamagent", "knowledge.db");
    const globalDbPath = path.join(tmp.home, ".teamagent", "global.db");
    const store = new DualLayerStore({ projectDbPath: dbPath, userGlobalDbPath: globalDbPath });
    const all = store.getAll();
    store.close();
    expect(all).toHaveLength(1);
    const entry = all[0]!;
    expect(entry.trigger).toBe("npm install moment");
    expect(entry.wrong_pattern).toBe("moment");
    expect(entry.correct_pattern).toBe("dayjs");
    expect(entry.scope.level).toBe("personal");
  });

  it("creates CLAUDE.md with TEAMAGENT block", () => {
    executePitfall(
      {
        trigger: "t",
        wrong: "w",
        correct: "c",
        reason: "r",
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );

    const mdPath = path.join(tmp.cwd, "CLAUDE.md");
    expect(fs.existsSync(mdPath)).toBe(true);
    const content = fs.readFileSync(mdPath, "utf-8");
    expect(content).toContain("TEAMAGENT:START");
    expect(content).toContain("使用 c 而非 w");
  });

  it("preserves existing CLAUDE.md content when updating", () => {
    const mdPath = path.join(tmp.cwd, "CLAUDE.md");
    fs.writeFileSync(mdPath, "# My Project\n\nRule: always X\n", "utf-8");

    executePitfall(
      { trigger: "t", wrong: "w", correct: "c", reason: "r" },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );

    const content = fs.readFileSync(mdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Rule: always X");
    expect(content).toContain("TEAMAGENT:START");
  });

  it("returns attribution block in smart mode by default", () => {
    const out = executePitfall(
      {
        trigger: "t",
        wrong: "moment",
        correct: "dayjs",
        reason: "r",
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );
    expect(out).toContain("✨ TeamAgent");
    expect(out).toContain("添加知识条目");
    expect(out).toContain("知识库变化: 0 → 1 条");
    expect(out).toContain("传播到:");
    expect(out).toContain("CLAUDE.md");
    expect(out).toContain("dayjs");
  });

  it("silent mode returns empty output", () => {
    const out = executePitfall(
      { trigger: "t", wrong: "w", correct: "c", reason: "r" },
      {
        cwd: tmp.cwd,
        homeDir: tmp.home,
        now: () => fixedNow,
        env: { TEAMAGENT_VISIBILITY: "silent" },
      },
    );
    expect(out).toBe("");
  });

  it("verbose mode includes counterfactual", () => {
    const out = executePitfall(
      { trigger: "t", wrong: "w", correct: "c", reason: "r" },
      {
        cwd: tmp.cwd,
        homeDir: tmp.home,
        now: () => fixedNow,
        env: { TEAMAGENT_VISIBILITY: "verbose" },
      },
    );
    expect(out).toContain("如果没有 TeamAgent");
  });

  it("empty wrong_pattern → type=practice", () => {
    executePitfall(
      {
        trigger: "代码审查前",
        wrong: "",
        correct: "运行完整测试套件确认零破坏",
        reason: "改了再测是敏捷核心",
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );
    const dbPath = path.join(tmp.cwd, ".teamagent", "knowledge.db");
    const globalDbPath = path.join(tmp.home, ".teamagent", "global.db");
    const store = new DualLayerStore({ projectDbPath: dbPath, userGlobalDbPath: globalDbPath });
    const all = store.getAll();
    store.close();
    expect(all[0]?.type).toBe("practice");
  });

  it("team level → personal scope in project DB (v2 maps team→personal)", () => {
    executePitfall(
      {
        trigger: "t",
        wrong: "w",
        correct: "c",
        reason: "r",
        level: "team",
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );

    const dbPath = path.join(tmp.cwd, ".teamagent", "knowledge.db");
    const globalDbPath = path.join(tmp.home, ".teamagent", "global.db");
    const store = new DualLayerStore({ projectDbPath: dbPath, userGlobalDbPath: globalDbPath });
    const all = store.getAll();
    store.close();
    expect(all).toHaveLength(1);
    expect(all[0]?.scope.level).toBe("personal");
  });

  it("subjective nature caps enforcement at warn even with high confidence", () => {
    executePitfall(
      {
        trigger: "t",
        wrong: "w",
        correct: "c",
        reason: "r",
        nature: "subjective",
      },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => fixedNow, env: {} },
    );
    const dbPath = path.join(tmp.cwd, ".teamagent", "knowledge.db");
    const globalDbPath = path.join(tmp.home, ".teamagent", "global.db");
    const store = new DualLayerStore({ projectDbPath: dbPath, userGlobalDbPath: globalDbPath });
    const all = store.getAll();
    store.close();
    expect(all[0]?.enforcement).toBe("warn");
  });
});

describe("parsePitfallArgs", () => {
  it("returns null without --non-interactive", () => {
    expect(parsePitfallArgs([])).toBeNull();
    expect(parsePitfallArgs(["--trigger=x"])).toBeNull();
  });

  it("parses flags into input object", () => {
    const input = parsePitfallArgs([
      "--non-interactive",
      "--trigger=npm install moment",
      "--wrong=moment",
      "--correct=dayjs",
      "--reason=deprecated",
      "--category=E",
      "--tags=tech-choice,date",
      "--level=personal",
      "--nature=subjective",
    ]);
    expect(input).toEqual({
      trigger: "npm install moment",
      wrong: "moment",
      correct: "dayjs",
      reason: "deprecated",
      category: "E",
      tags: ["tech-choice", "date"],
      level: "personal",
      nature: "subjective",
    });
  });

  it("handles missing optional flags", () => {
    const input = parsePitfallArgs([
      "--non-interactive",
      "--trigger=t",
      "--wrong=w",
      "--correct=c",
      "--reason=r",
    ]);
    expect(input).not.toBeNull();
    expect(input!.trigger).toBe("t");
    expect(input!.category).toBeUndefined();
    expect(input!.tags).toBeUndefined();
  });
});
