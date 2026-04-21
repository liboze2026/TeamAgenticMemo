import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWikiRefresh } from "../wiki-refresh.js";

describe("runWikiRefresh", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "wiki-refresh-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("不存在 .teamagent 目录时：silent exit，不抛", async () => {
    await expect(runWikiRefresh({ cwd, force: false })).resolves.toBeDefined();
  });

  it("debounce 未过期：skip 不跑 pipeline（force=false）", async () => {
    const teamagentDir = join(cwd, ".teamagent");
    mkdirSync(teamagentDir, { recursive: true });
    writeFileSync(
      join(teamagentDir, "wiki-last-pull.json"),
      JSON.stringify({ attemptedAt: new Date().toISOString(), added: 0, archived: 0 }),
    );

    const pipelineCalls: number[] = [];
    const result = await runWikiRefresh({
      cwd,
      force: false,
      _testDeps: {
        openDb: () => ({ close: () => {} } as any),
        runPipeline: async () => { pipelineCalls.push(1); return { added: 0, skipped: 0, rejected: 0, errors: [] }; },
        runSweep: () => ({ archived: [], byReason: { zeroHitAged: 0, sourceOverflow: 0 } }),
      },
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("debounced");
    expect(pipelineCalls).toEqual([]);
  });

  it("force=true 时忽略 debounce 并重写 marker", async () => {
    const teamagentDir = join(cwd, ".teamagent");
    mkdirSync(teamagentDir, { recursive: true });
    const originalAttemptedAt = new Date("2026-04-20T00:00:00Z").toISOString();
    writeFileSync(
      join(teamagentDir, "wiki-last-pull.json"),
      JSON.stringify({ attemptedAt: originalAttemptedAt, added: 0, archived: 0 }),
    );

    const pipelineCalls: number[] = [];
    const result = await runWikiRefresh({
      cwd,
      force: true,
      _testDeps: {
        openDb: () => ({ close: () => {} } as any),
        runPipeline: async () => { pipelineCalls.push(1); return { added: 2, skipped: 0, rejected: 0, errors: [] }; },
        runSweep: () => ({ archived: [{ knowledgeId: "x", reason: "zero-hit-aged" as const }], byReason: { zeroHitAged: 1, sourceOverflow: 0 } }),
      },
    });

    expect(result.skipped).toBe(false);
    expect(result.added).toBe(2);
    expect(result.archived).toBe(1);
    expect(pipelineCalls).toEqual([1]);

    // marker 被重写
    const raw = require("node:fs").readFileSync(join(teamagentDir, "wiki-last-pull.json"), "utf-8");
    const rewritten = JSON.parse(raw);
    expect(rewritten.attemptedAt).not.toBe(originalAttemptedAt);
    expect(rewritten.added).toBe(2);
    expect(rewritten.archived).toBe(1);
  });

  it("sweep.enabled=false → 不跑 sweep", async () => {
    const teamagentDir = join(cwd, ".teamagent");
    mkdirSync(teamagentDir, { recursive: true });
    writeFileSync(join(teamagentDir, "config.json"),
      JSON.stringify({ wiki: { sweep: { enabled: false } } }));
    const sweepCalls: number[] = [];
    await runWikiRefresh({
      cwd,
      force: true,
      _testDeps: {
        openDb: () => ({ close: () => {} } as any),
        runPipeline: async () => ({ added: 0, skipped: 0, rejected: 0, errors: [] }),
        runSweep: () => { sweepCalls.push(1); return { archived: [], byReason: { zeroHitAged: 0, sourceOverflow: 0 } }; },
      },
    });
    expect(sweepCalls).toEqual([]);
  });

  it("pipeline 抛异常：记录到 errors 但继续跑 sweep 并更新 marker", async () => {
    const teamagentDir = join(cwd, ".teamagent");
    mkdirSync(teamagentDir, { recursive: true });
    const sweepCalls: number[] = [];
    const result = await runWikiRefresh({
      cwd,
      force: true,
      _testDeps: {
        openDb: () => ({ close: () => {} } as any),
        runPipeline: async () => { throw new Error("network down"); },
        runSweep: () => { sweepCalls.push(1); return { archived: [], byReason: { zeroHitAged: 0, sourceOverflow: 0 } }; },
      },
    });

    expect(result.skipped).toBe(false);
    expect(result.errors.some(e => e.stage === "pipeline-run")).toBe(true);
    expect(sweepCalls).toEqual([1]);  // sweep still ran
  });
});
