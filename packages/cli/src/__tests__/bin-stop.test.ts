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

import { executeAnalyze } from "../commands/analyze.js";
import { executeCalibrate } from "../commands/calibrate.js";
import { executeCompile } from "../commands/compile.js";

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
});
