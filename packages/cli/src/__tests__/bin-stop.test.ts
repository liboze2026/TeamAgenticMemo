import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runStopPipeline, type StopHookInput } from "../bin-stop.js";

vi.mock("../commands/analyze.js", () => ({
  executeAnalyze: vi.fn().mockResolvedValue("analyze done"),
}));
vi.mock("../commands/calibrate.js", () => ({
  executeCalibrate: vi.fn().mockResolvedValue({ dryRun: false }),
}));
vi.mock("../commands/compile.js", () => ({
  executeCompile: vi.fn().mockResolvedValue({
    markdown: { path: "CLAUDE.md", blockLineCount: 5 },
    skills: { written: [], removed: [] },
  }),
}));
vi.mock("../commands/recent-entries.js", () => ({
  getRecentEntries: vi.fn(),
}));
// Prevent tests from writing to the real project's .teamagent/last-harvest.md
vi.mock("../harvest-writer.js", () => ({
  appendHarvest: vi.fn(),
  getHarvestPath: vi.fn((cwd: string) => `${cwd}/.teamagent/last-harvest.md`),
}));
// Prevent tests from touching real scan-cursor.json
vi.mock("../scan-cursor.js", () => ({
  readCursor: vi.fn(() => -1),
  writeCursor: vi.fn(),
  clearCursor: vi.fn(),
  readSeen: vi.fn(() => new Set<string>()),
  writeSeen: vi.fn(),
}));

import { executeAnalyze } from "../commands/analyze.js";
import { executeCalibrate } from "../commands/calibrate.js";
import { executeCompile } from "../commands/compile.js";
import { getRecentEntries } from "../commands/recent-entries.js";

describe("runStopPipeline", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("calls analyze with transcript_path and commit=true", async () => {
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(executeAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        session: "/tmp/session.jsonl",
        commit: true,
        cwd: process.cwd(),
      })
    );
  });

  it("calls calibrate and compile after analyze", async () => {
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(executeCalibrate).toHaveBeenCalled();
    expect(executeCompile).toHaveBeenCalled();
  });

  it("continues pipeline even if analyze throws", async () => {
    vi.mocked(executeAnalyze).mockRejectedValueOnce(new Error("analyze failed"));
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await expect(runStopPipeline(input)).resolves.not.toThrow();
    expect(executeCalibrate).toHaveBeenCalled();
    expect(executeCompile).toHaveBeenCalled();
  });

  it("resolves even if all steps throw", async () => {
    vi.mocked(executeAnalyze).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(executeCalibrate).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(executeCompile).mockRejectedValueOnce(new Error("fail"));
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await expect(runStopPipeline(input)).resolves.toBeUndefined();
  });

  // Regression: Stop hook can fire before Claude flushes the transcript jsonl.
  // Previous behavior threw on the first "Session not found" and skipped to
  // calibrate/compile; analyze must retry instead so most sessions actually
  // produce candidates.
  it("retries analyze when it throws Session not found", async () => {
    vi.mocked(executeAnalyze)
      .mockRejectedValueOnce(new Error("Session not found: /tmp/session.jsonl"))
      .mockRejectedValueOnce(new Error("Session not found: /tmp/session.jsonl"))
      .mockResolvedValueOnce("analyze done");
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(executeAnalyze).toHaveBeenCalledTimes(3);
  });

  it("does not retry on unrelated errors", async () => {
    vi.mocked(executeAnalyze).mockRejectedValueOnce(new Error("unexpected format"));
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(executeAnalyze).toHaveBeenCalledTimes(1);
  });

  it("retries on permission denied (Windows file lock race)", async () => {
    vi.mocked(executeAnalyze)
      .mockRejectedValueOnce(new Error("EACCES: permission denied, open '/tmp/session.jsonl'"))
      .mockResolvedValueOnce("分析完成\n");
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(executeAnalyze).toHaveBeenCalledTimes(2);
  });

  it("outputs stdout learning summary when recent entries exist", async () => {
    vi.mocked(getRecentEntries).mockResolvedValue([
      { tldr: "用 dayjs 代替 moment", confidence: 0.92 },
      { tldr: "凭据持久化", confidence: 0.80 },
    ]);
    const stdoutWrites: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutWrites.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    const combined = stdoutWrites.join("");
    expect(combined).toContain("✦ TeamAgent 本会话学到 2 条新经验");
    expect(combined).toContain("dayjs");
    expect(combined).toContain("0.92");
    stdoutSpy.mockRestore();
  });

  it("stdout is silent when no recent entries", async () => {
    vi.mocked(getRecentEntries).mockResolvedValue([]);
    const stdoutWrites: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutWrites.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });
    const input: StopHookInput = {
      session_id: "abc123",
      transcript_path: "/tmp/session.jsonl",
      cwd: process.cwd(),
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    const combined = stdoutWrites.join("");
    expect(combined).not.toContain("✦ TeamAgent");
    stdoutSpy.mockRestore();
  });
});

describe("runStopPipeline lock file", () => {
  let tmpCwd: string;
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore baseline resolving mocks (earlier describe's mockRejectedValueOnce
    // queue may have drained already, but reset to be safe).
    vi.mocked(executeAnalyze).mockResolvedValue("analyze done");
    vi.mocked(executeCalibrate).mockResolvedValue({ dryRun: false } as never);
    vi.mocked(executeCompile).mockResolvedValue({
      markdown: { path: "CLAUDE.md", blockLineCount: 5 },
      skills: { written: [], removed: [] },
    } as never);
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "stop-lock-"));
  });
  afterEach(() => {
    fs.rmSync(tmpCwd, { recursive: true, force: true });
  });

  it("writes and deletes lock file during pipeline run", async () => {
    const lockPath = path.join(tmpCwd, ".teamagent", ".stop-running.lock");
    let lockSeenDuringAnalyze = false;
    let lockPayload: { pid?: number; started_at?: string } | null = null;

    vi.mocked(executeAnalyze).mockImplementationOnce(async () => {
      lockSeenDuringAnalyze = fs.existsSync(lockPath);
      if (lockSeenDuringAnalyze) {
        lockPayload = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
      }
      return "analyze done";
    });

    const input: StopHookInput = {
      session_id: "x",
      transcript_path: "/tmp/t.jsonl",
      cwd: tmpCwd,
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(lockSeenDuringAnalyze).toBe(true);
    const payload = lockPayload as { pid?: number; started_at?: string } | null;
    expect(payload?.pid).toBe(process.pid);
    expect(typeof payload?.started_at).toBe("string");
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("removes lock even if pipeline throws", async () => {
    const lockPath = path.join(tmpCwd, ".teamagent", ".stop-running.lock");
    vi.mocked(executeAnalyze).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(executeCalibrate).mockRejectedValueOnce(new Error("boom2"));
    vi.mocked(executeCompile).mockRejectedValueOnce(new Error("boom3"));

    const input: StopHookInput = {
      session_id: "x",
      transcript_path: "/tmp/t.jsonl",
      cwd: tmpCwd,
      hook_event_name: "Stop",
    };
    await runStopPipeline(input);
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});
