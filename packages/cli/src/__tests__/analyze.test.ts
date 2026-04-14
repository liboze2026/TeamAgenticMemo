import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nodeFs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeAnalyze, parseAnalyzeArgs } from "../commands/analyze.js";
import type { LLMClient } from "@teamagent/ports";

function mkTmp() {
  const dir = nodeFs.mkdtempSync(path.join(os.tmpdir(), "analyze-"));
  return {
    dir,
    cleanup: () => nodeFs.rmSync(dir, { recursive: true, force: true }),
  };
}

const FIXTURE_ROOT = path.resolve(process.cwd(), "fixtures/sessions");

describe("executeAnalyze", () => {
  let tmp: ReturnType<typeof mkTmp>;

  beforeEach(() => {
    tmp = mkTmp();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("directly given fixture path → analyzes + renders report", async () => {
    const fixturePath = path.join(FIXTURE_ROOT, "correction-denial-01.jsonl");
    const out = await executeAnalyze({
      session: fixturePath,
      homeDir: tmp.dir,
    });
    expect(out).toContain("TeamAgent Session Analyze");
    expect(out).toContain("回合数: 2");
    expect(out).toContain("纠正时刻: 1");
    expect(out).toContain("explicit_denial");
  });

  it("mixed fixture → both corrections and successes reported", async () => {
    const out = await executeAnalyze({
      session: path.join(FIXTURE_ROOT, "mixed-01.jsonl"),
      homeDir: tmp.dir,
    });
    expect(out).toContain("纠正时刻: 1");
    expect(out).toContain("成功信号: 1");
  });

  it("no signal fixture → 0 counts", async () => {
    const out = await executeAnalyze({
      session: path.join(FIXTURE_ROOT, "negative-no-signal-01.jsonl"),
      homeDir: tmp.dir,
    });
    expect(out).toContain("纠正时刻: 0");
  });

  it("no ~/.claude/projects → helpful message", async () => {
    const out = await executeAnalyze({
      homeDir: tmp.dir,
      projectsRoot: path.join(tmp.dir, "nonexistent"),
    });
    expect(out).toContain("未找到");
  });

  it("verbose flag → prints detail lines", async () => {
    const out = await executeAnalyze({
      session: path.join(FIXTURE_ROOT, "correction-denial-01.jsonl"),
      homeDir: tmp.dir,
      verbose: true,
    });
    expect(out).toContain("纠正时刻明细");
    expect(out).toContain("turn");
  });

  it("dry-run notice in footer", async () => {
    const out = await executeAnalyze({
      session: path.join(FIXTURE_ROOT, "correction-denial-01.jsonl"),
      homeDir: tmp.dir,
    });
    expect(out).toContain("未写入知识库");
  });

  describe("--commit mode", () => {
    const stubLLM = (response: string): LLMClient => ({
      complete: async () => response,
    });

    it("extracts corrections via LLM and writes to store + CLAUDE.md", async () => {
      const teamPath = path.join(tmp.dir, "team.jsonl");
      const claudeMdPath = path.join(tmp.dir, "CLAUDE.md");

      const llm = stubLLM(
        "```json\n" +
          JSON.stringify({
            category: "E",
            tags: ["http-client"],
            type: "avoidance",
            nature: "subjective",
            trigger: "需要发 HTTP 请求",
            wrong_pattern: "axios",
            correct_pattern: "fetch",
            reasoning: "零依赖偏好",
          }) +
          "\n```",
      );

      const out = await executeAnalyze({
        session: path.join(FIXTURE_ROOT, "correction-denial-01.jsonl"),
        homeDir: tmp.dir,
        cwd: tmp.dir,
        commit: true,
        llmClient: llm,
        teamPath,
        claudeMdPath,
        idGen: () => "team-test-0001",
        now: () => new Date("2026-04-14T12:00:00Z"),
      });

      expect(out).toContain("--commit 模式");
      expect(out).toContain("成功提取: 1");
      expect(out).toContain("知识库: 0 → 1");
      expect(out).toContain("需要发 HTTP 请求");

      // store 落盘
      const storeContent = nodeFs.readFileSync(teamPath, "utf-8");
      expect(storeContent).toContain("team-test-0001");
      expect(storeContent).toContain("axios");

      // CLAUDE.md 写入
      const md = nodeFs.readFileSync(claudeMdPath, "utf-8");
      expect(md).toContain("TEAMAGENT:START");
      expect(md).toContain("fetch");
    });

    it("LLM returning null → skipped, nothing written", async () => {
      const teamPath = path.join(tmp.dir, "team.jsonl");
      const claudeMdPath = path.join(tmp.dir, "CLAUDE.md");

      const out = await executeAnalyze({
        session: path.join(FIXTURE_ROOT, "correction-denial-01.jsonl"),
        homeDir: tmp.dir,
        cwd: tmp.dir,
        commit: true,
        llmClient: stubLLM("null"),
        teamPath,
        claudeMdPath,
        idGen: () => "never-used",
        now: () => new Date("2026-04-14T12:00:00Z"),
      });

      expect(out).toContain("成功提取: 0");
      expect(out).toContain("跳过 1");
      // Store may exist (constructor touches it) but must be empty
      const storeContent = nodeFs.existsSync(teamPath)
        ? nodeFs.readFileSync(teamPath, "utf-8").trim()
        : "";
      expect(storeContent).toBe("");
    });

    it("per-correction LLM error does not abort run", async () => {
      const teamPath = path.join(tmp.dir, "team.jsonl");
      const claudeMdPath = path.join(tmp.dir, "CLAUDE.md");

      let call = 0;
      const llm: LLMClient = {
        complete: async () => {
          call++;
          throw new Error("boom");
        },
      };

      const out = await executeAnalyze({
        session: path.join(FIXTURE_ROOT, "correction-denial-01.jsonl"),
        homeDir: tmp.dir,
        cwd: tmp.dir,
        commit: true,
        llmClient: llm,
        teamPath,
        claudeMdPath,
        idGen: () => "never",
        now: () => new Date("2026-04-14T12:00:00Z"),
      });

      expect(out).toContain("失败 1");
      expect(call).toBeGreaterThan(0);
    });
  });
});

describe("parseAnalyzeArgs", () => {
  it("empty → no options", () => {
    expect(parseAnalyzeArgs([])).toEqual({});
  });

  it("--verbose", () => {
    expect(parseAnalyzeArgs(["--verbose"])).toEqual({ verbose: true });
    expect(parseAnalyzeArgs(["-v"])).toEqual({ verbose: true });
  });

  it("--session=path", () => {
    expect(parseAnalyzeArgs(["--session=/a/b.jsonl"])).toEqual({
      session: "/a/b.jsonl",
    });
  });

  it("--session path (two args)", () => {
    expect(parseAnalyzeArgs(["--session", "abc"])).toEqual({ session: "abc" });
  });

  it("combined", () => {
    expect(parseAnalyzeArgs(["--session=x", "-v"])).toEqual({
      session: "x",
      verbose: true,
    });
  });

  it("--commit flag", () => {
    expect(parseAnalyzeArgs(["--commit"])).toEqual({ commit: true });
    expect(parseAnalyzeArgs(["--session=a", "--commit", "-v"])).toEqual({
      session: "a",
      commit: true,
      verbose: true,
    });
  });
});
