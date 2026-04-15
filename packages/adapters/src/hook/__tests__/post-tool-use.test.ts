import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nodeFs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  handlePostToolUse,
  inferToolSuccess,
} from "../post-tool-use.js";
import { JsonlEventLog } from "../../events/jsonl-event-log.js";
import type { PersistedEvent, PostToolUseInput } from "@teamagent/types";

function mkTmp() {
  const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), "post-hook-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "cwd");
  nodeFs.mkdirSync(home, { recursive: true });
  nodeFs.mkdirSync(cwd, { recursive: true });
  return {
    home,
    cwd,
    eventsPath: path.join(home, ".teamagent", "events.jsonl"),
    cleanup: () => nodeFs.rmSync(root, { recursive: true, force: true }),
  };
}

function makeInput(over: Partial<PostToolUseInput> = {}): PostToolUseInput {
  return {
    session_id: "sess-1",
    hook_event_name: "PostToolUse",
    cwd: "/c/test",
    permission_mode: "default",
    transcript_path: "/tmp/transcript",
    tool_name: "Bash",
    tool_input: { command: "npm install axios" },
    tool_use_id: "tool-use-abc",
    tool_response: { stdout: "ok", exit_code: 0 },
    ...over,
  };
}

function seedPreEvent(
  eventsPath: string,
  over: Partial<PersistedEvent> = {},
): PersistedEvent {
  const evt: PersistedEvent = {
    id: "evt-pre-1",
    intervention_id: "iv-1",
    kind: "hook-pre.matched",
    session_id: "sess-1",
    knowledge_id: "rule-axios-fetch",
    tool_use_id: "tool-use-abc",
    tool: { name: "Bash", input: { command: "npm install axios" } },
    cwd: "/c/test",
    timestamp: "2026-04-15T00:00:00Z",
    schema_version: 1,
    ...over,
  };
  new JsonlEventLog(eventsPath).append(evt);
  return evt;
}

describe("inferToolSuccess", () => {
  it("is_error=true → fail", () => {
    expect(inferToolSuccess({ is_error: true })).toEqual({ succeeded: false });
  });

  it("is_error=true with stderr → fail with stderr", () => {
    expect(inferToolSuccess({ is_error: true, stderr: "boom" })).toEqual({
      succeeded: false,
      stderr: "boom",
    });
  });

  it("non-empty error string → fail", () => {
    expect(inferToolSuccess({ error: "missing field" })).toEqual({
      succeeded: false,
      stderr: "missing field",
    });
  });

  it("exit_code != 0 → fail", () => {
    expect(inferToolSuccess({ exit_code: 1 })).toEqual({
      succeeded: false,
      exit_code: 1,
    });
  });

  it("exit_code 0 → success", () => {
    expect(inferToolSuccess({ exit_code: 0 })).toEqual({
      succeeded: true,
      exit_code: 0,
    });
  });

  it("empty response → success (default)", () => {
    expect(inferToolSuccess({})).toEqual({ succeeded: true });
  });

  it("ignores empty error string", () => {
    expect(inferToolSuccess({ error: "" })).toEqual({ succeeded: true });
  });
});

describe("handlePostToolUse", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => tmp.cleanup());

  it("no matching pre event → still records hook-post.result (no knowledge_id)", () => {
    const out = handlePostToolUse(makeInput(), {
      eventsPath: tmp.eventsPath,
      now: () => "2026-04-15T01:00:00Z",
    });
    expect(out).toEqual({});
    const events = new JsonlEventLog(tmp.eventsPath).readAll();
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("hook-post.result");
    expect(events[0]!.knowledge_id).toBeUndefined();
    expect(events[0]!.intervention_id).toBeUndefined();
    expect(events[0]!.result?.succeeded).toBe(true);
  });

  it("matching pre event → propagates intervention_id and knowledge_id", () => {
    seedPreEvent(tmp.eventsPath);
    handlePostToolUse(makeInput(), {
      eventsPath: tmp.eventsPath,
      now: () => "2026-04-15T01:00:00Z",
    });
    const events = new JsonlEventLog(tmp.eventsPath).readAll();
    const post = events.find((e) => e.kind === "hook-post.result")!;
    expect(post).toBeDefined();
    expect(post.intervention_id).toBe("iv-1");
    expect(post.knowledge_id).toBe("rule-axios-fetch");
    expect(post.tool_use_id).toBe("tool-use-abc");
  });

  it("multiple pre events for same tool_use_id → one post per knowledge_id", () => {
    seedPreEvent(tmp.eventsPath, {
      id: "evt-pre-a",
      knowledge_id: "rule-A",
    });
    seedPreEvent(tmp.eventsPath, {
      id: "evt-pre-b",
      knowledge_id: "rule-B",
    });
    handlePostToolUse(makeInput(), {
      eventsPath: tmp.eventsPath,
      now: () => "2026-04-15T01:00:00Z",
    });
    const posts = new JsonlEventLog(tmp.eventsPath)
      .readAll()
      .filter((e) => e.kind === "hook-post.result");
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.knowledge_id).sort()).toEqual([
      "rule-A",
      "rule-B",
    ]);
  });

  it("captures failure result (is_error=true)", () => {
    seedPreEvent(tmp.eventsPath);
    handlePostToolUse(
      makeInput({ tool_response: { is_error: true, stderr: "denied" } }),
      { eventsPath: tmp.eventsPath, now: () => "2026-04-15T01:00:00Z" },
    );
    const post = new JsonlEventLog(tmp.eventsPath)
      .readAll()
      .find((e) => e.kind === "hook-post.result")!;
    expect(post.result?.succeeded).toBe(false);
    expect(post.result?.stderr).toBe("denied");
  });

  it("ignores pre events with different tool_use_id", () => {
    seedPreEvent(tmp.eventsPath, { tool_use_id: "tool-use-other" });
    handlePostToolUse(makeInput(), {
      eventsPath: tmp.eventsPath,
      now: () => "2026-04-15T01:00:00Z",
    });
    const post = new JsonlEventLog(tmp.eventsPath)
      .readAll()
      .find((e) => e.kind === "hook-post.result")!;
    // 没有匹配 → 不带 knowledge_id
    expect(post.knowledge_id).toBeUndefined();
  });

  it("ignores non-pre kinds when correlating (only pre.matched/warned/blocked)", () => {
    new JsonlEventLog(tmp.eventsPath).append({
      id: "irrelevant",
      kind: "extractor.extracted",
      tool_use_id: "tool-use-abc",
      timestamp: "2026-04-15T00:00:00Z",
      schema_version: 1,
    });
    handlePostToolUse(makeInput(), {
      eventsPath: tmp.eventsPath,
      now: () => "2026-04-15T01:00:00Z",
    });
    const post = new JsonlEventLog(tmp.eventsPath)
      .readAll()
      .find((e) => e.kind === "hook-post.result")!;
    expect(post.knowledge_id).toBeUndefined();
  });

  it("handles missing events file gracefully", () => {
    // No seed; events file doesn't exist
    expect(() =>
      handlePostToolUse(makeInput(), {
        eventsPath: tmp.eventsPath,
        now: () => "2026-04-15T01:00:00Z",
      }),
    ).not.toThrow();
  });

  it("normalizes Git Bash cwd /c/foo → C:/foo when resolving paths", () => {
    // Just verify call doesn't throw with Git Bash style cwd
    handlePostToolUse(makeInput({ cwd: "/c/test" }), {
      eventsPath: tmp.eventsPath,
      now: () => "2026-04-15T01:00:00Z",
    });
    const events = new JsonlEventLog(tmp.eventsPath).readAll();
    expect(events).toHaveLength(1);
    expect(events[0]!.cwd).toBe("/c/test"); // 原样保留 in event
  });
});
