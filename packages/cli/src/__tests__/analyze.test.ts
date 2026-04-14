import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nodeFs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeAnalyze, parseAnalyzeArgs } from "../commands/analyze.js";

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
});
