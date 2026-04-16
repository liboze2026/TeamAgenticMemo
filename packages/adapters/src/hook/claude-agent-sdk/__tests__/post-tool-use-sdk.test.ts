import { describe, it, expect, vi } from "vitest";
import { createPostToolUseHandler } from "../post-tool-use-sdk.js";

describe("createPostToolUseHandler (SDK)", () => {
  it("emits hook-post.result events for each rule that fired in Pre", async () => {
    const mockEventLog = {
      append: vi.fn(),
      readLast: vi.fn().mockReturnValue([
        { id: "pre-1", kind: "hook-pre.warned", knowledge_id: "r1", tool_use_id: "tu-X", timestamp: "t" },
      ]),
    };
    const handler = createPostToolUseHandler({ eventLog: mockEventLog as any });

    await handler({
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts" },
      tool_response: { success: true },
      tool_use_id: "tu-X",
    } as any);

    expect(mockEventLog.append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "hook-post.result", knowledge_id: "r1" })
    );
  });

  it("infers success from tool_response", async () => {
    const handler = createPostToolUseHandler({
      eventLog: { append: vi.fn(), readLast: vi.fn().mockReturnValue([]) } as any,
    });
    const result = await handler({
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "echo" },
      tool_response: { is_error: false, exit_code: 0 },
      tool_use_id: "tu-OK",
    } as any);
    expect(result).toBeDefined();
  });

  it("infers failure from error tool_response", async () => {
    const mockEventLog = {
      append: vi.fn(),
      readLast: vi.fn().mockReturnValue([
        { id: "pre-1", kind: "hook-pre.blocked", knowledge_id: "r1", tool_use_id: "tu-FAIL", timestamp: "t" },
      ]),
    };
    const handler = createPostToolUseHandler({ eventLog: mockEventLog as any });
    await handler({
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: {},
      tool_response: { is_error: true, error: "something broke" },
      tool_use_id: "tu-FAIL",
    } as any);
    const call = mockEventLog.append.mock.calls.find((c: any[]) => c[0].kind === "hook-post.result");
    expect(call).toBeDefined();
    expect(call![0].payload?.success).toBe(false);
  });
});
