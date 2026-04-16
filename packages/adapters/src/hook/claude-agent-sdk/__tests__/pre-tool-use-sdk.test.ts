import { describe, it, expect, vi } from "vitest";
import { createPreToolUseHandler } from "../pre-tool-use-sdk.js";

describe("createPreToolUseHandler (SDK)", () => {
  it("returns allow when no rules match", async () => {
    const mockMatcher = { match: vi.fn().mockResolvedValue({ matched: [] }) };
    const mockEventLog = { append: vi.fn() };
    const handler = createPreToolUseHandler({ matcher: mockMatcher as any, eventLog: mockEventLog as any });

    const result = await handler({
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts", new_string: "x" },
      tool_use_id: "tu-1",
    } as any);

    expect(result.permissionDecision).toBe("allow");
    expect(mockEventLog.append).toHaveBeenCalledWith(expect.objectContaining({ kind: "hook-pre.passed" }));
  });

  it("returns deny + reason when enforced rule matches", async () => {
    const enforcedRule = {
      id: "r1",
      current_tier: "enforced",
      enforcement: "block",
      trigger: "use axios",
      correct_pattern: "use fetch",
      reasoning: "project is fetch-only",
      confidence: 0.9,
    };
    const mockMatcher = { match: vi.fn().mockResolvedValue({ matched: [enforcedRule] }) };
    const mockEventLog = { append: vi.fn() };
    const handler = createPreToolUseHandler({ matcher: mockMatcher as any, eventLog: mockEventLog as any });

    const result = await handler({
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts", new_string: "axios.get(url)" },
      tool_use_id: "tu-2",
    } as any);

    expect(result.permissionDecision).toBe("deny");
    expect(result.permissionDecisionReason).toContain("fetch");
    expect(mockEventLog.append).toHaveBeenCalledWith(expect.objectContaining({ kind: "hook-pre.blocked" }));
  });

  it("warned rules → allow + systemMessage (exit 0 JSON)", async () => {
    const warnRule = {
      id: "r1",
      current_tier: "stable",
      enforcement: "warn",
      trigger: "use axios",
      correct_pattern: "use fetch",
      reasoning: "",
      confidence: 0.7,
    };
    const mockMatcher = { match: vi.fn().mockResolvedValue({ matched: [warnRule] }) };
    const mockEventLog = { append: vi.fn() };
    const handler = createPreToolUseHandler({ matcher: mockMatcher as any, eventLog: mockEventLog as any });

    const result = await handler({
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a.ts", new_string: "axios.get(url)" },
      tool_use_id: "tu-3",
    } as any);

    expect(result.permissionDecision).toBe("allow");
    expect(result.systemMessage).toContain("fetch");
    expect(mockEventLog.append).toHaveBeenCalledWith(expect.objectContaining({ kind: "hook-pre.warned" }));
  });
});
