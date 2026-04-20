import { describe, it, expect, vi, beforeEach } from "vitest";
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
