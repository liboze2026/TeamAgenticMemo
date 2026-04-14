import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { handlePreToolUse } from "../pre-tool-use.js";
import { JsonlKnowledgeStore } from "../../storage/jsonl-store.js";
import { JsonlEventLog } from "../../events/jsonl-event-log.js";
import type {
  KnowledgeEntry,
  PreToolUseInput,
  HookOutput,
} from "@teamagent/types";

function mkTmp() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "hook-home-"));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hook-cwd-"));
  return {
    home,
    cwd,
    cleanup: () => {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    },
  };
}

function seedRule(file: string, overrides: Partial<KnowledgeEntry>): void {
  const store = new JsonlKnowledgeStore(file);
  store.add({
    id: "r-" + Math.random().toString(36).slice(2, 8),
    scope: { level: "personal" },
    category: "E",
    tags: ["t"],
    type: "avoidance",
    nature: "objective",
    trigger: "",
    wrong_pattern: "",
    correct_pattern: "",
    reasoning: "",
    confidence: 0.8,
    enforcement: "warn",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-04-14T00:00:00Z",
    last_hit_at: "",
    last_validated_at: "",
    source: "accumulated",
    conflict_with: [],
    ...overrides,
  });
}

function makeInput(overrides: Partial<PreToolUseInput> = {}): PreToolUseInput {
  return {
    session_id: "sess-1",
    hook_event_name: "PreToolUse",
    cwd: "/cwd",
    permission_mode: "default",
    transcript_path: "/transcript.jsonl",
    tool_name: "Bash",
    tool_input: { command: "ls" },
    tool_use_id: "tool-1",
    ...overrides,
  };
}

describe("handlePreToolUse", () => {
  let tmp: ReturnType<typeof mkTmp>;
  let personalPath: string;
  let teamPath: string;
  let globalPath: string;
  let eventsPath: string;

  beforeEach(() => {
    tmp = mkTmp();
    personalPath = path.join(tmp.home, ".teamagent", "personal", "knowledge.jsonl");
    teamPath = path.join(tmp.cwd, ".teamagent", "knowledge.jsonl");
    globalPath = path.join(tmp.home, ".teamagent", "global", "knowledge.jsonl");
    eventsPath = path.join(tmp.home, ".teamagent", "events.jsonl");
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("no rules → exit 0 with empty output (no JSON)", () => {
    const out = handlePreToolUse(makeInput(), {
      personalPath,
      teamPath,
      globalPath,
      eventsPath,
      now: () => "2026-04-14T00:00:00Z",
    });
    expect(out).toEqual({});
  });

  it("no match → exit 0 with empty output", () => {
    seedRule(personalPath, { wrong_pattern: "moment" });
    const out = handlePreToolUse(
      makeInput({ tool_input: { command: "npm install dayjs" } }),
      { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
    );
    expect(out).toEqual({});
  });

  it("block-enforcement match → permissionDecision: deny + reason", () => {
    seedRule(personalPath, {
      wrong_pattern: "rm -rf",
      correct_pattern: "git clean -fd 或具体路径",
      reasoning: "rm -rf 不可逆，应使用更安全的替代",
      enforcement: "block",
    });
    const out: HookOutput = handlePreToolUse(
      makeInput({ tool_input: { command: "rm -rf /important" } }),
      { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
    );
    expect(out.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput?.permissionDecisionReason).toContain("git clean");
    expect(out.hookSpecificOutput?.permissionDecisionReason).toContain("不可逆");
  });

  it("warn-enforcement match → allow + systemMessage + additionalContext", () => {
    seedRule(personalPath, {
      wrong_pattern: "moment",
      correct_pattern: "dayjs",
      reasoning: "moment 已停止维护",
      enforcement: "warn",
    });
    const out: HookOutput = handlePreToolUse(
      makeInput({ tool_input: { command: "npm install moment" } }),
      { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
    );
    expect(out.hookSpecificOutput?.permissionDecision).toBe("allow");
    expect(out.systemMessage).toContain("dayjs");
    expect(out.systemMessage).toContain("moment");
    expect(out.hookSpecificOutput?.additionalContext).toContain("dayjs");
  });

  it("logs event to events.jsonl on match", () => {
    seedRule(personalPath, {
      wrong_pattern: "moment",
      correct_pattern: "dayjs",
      reasoning: "r",
      enforcement: "warn",
    });
    handlePreToolUse(
      makeInput({ tool_input: { command: "npm install moment" } }),
      { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
    );

    const events = new JsonlEventLog(eventsPath).readAll();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const evt = events.find((e) => e.kind === "hook-pre.warned");
    expect(evt).toBeDefined();
    expect(evt!.intervention_id).toMatch(/^iv-/);
    expect(evt!.knowledge_id).toBeDefined();
    expect(evt!.tool?.name).toBe("Bash");
    expect(evt!.session_id).toBe("sess-1");
    expect(evt!.schema_version).toBe(1);
  });

  it("logs hook-pre.blocked when block enforcement", () => {
    seedRule(personalPath, {
      wrong_pattern: "rm -rf",
      correct_pattern: "safer",
      reasoning: "r",
      enforcement: "block",
    });
    handlePreToolUse(
      makeInput({ tool_input: { command: "rm -rf x" } }),
      { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
    );
    const events = new JsonlEventLog(eventsPath).readAll();
    expect(events.find((e) => e.kind === "hook-pre.blocked")).toBeDefined();
  });

  it("multiple matches: highest enforcement wins, all logged", () => {
    seedRule(personalPath, {
      wrong_pattern: "x",
      enforcement: "warn",
      correct_pattern: "warn-correct",
      reasoning: "warn-reason",
    });
    seedRule(personalPath, {
      wrong_pattern: "x",
      enforcement: "block",
      correct_pattern: "block-correct",
      reasoning: "block-reason",
    });
    const out = handlePreToolUse(
      makeInput({ tool_input: { command: "x" } }),
      { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
    );
    // block wins
    expect(out.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput?.permissionDecisionReason).toContain("block-correct");

    const events = new JsonlEventLog(eventsPath).readAll();
    // both rules produce hook-pre.matched events
    expect(events.filter((e) => e.kind === "hook-pre.matched").length).toBeGreaterThanOrEqual(1);
  });

  it("internal error (corrupt store) → returns empty (does not break user)", () => {
    // Create a malformed personal store
    fs.mkdirSync(path.dirname(personalPath), { recursive: true });
    fs.writeFileSync(personalPath, "completely invalid json on every line\nstill garbage\n");

    const out = handlePreToolUse(makeInput(), {
      personalPath,
      teamPath,
      globalPath,
      eventsPath,
      now: () => "2026-04-14T00:00:00Z",
    });
    // store with all corrupt lines yields 0 entries → no match → empty output
    expect(out).toEqual({});
  });

  it("merges rules from personal + team + global stores", () => {
    seedRule(personalPath, { wrong_pattern: "personal-rule", correct_pattern: "p-c", reasoning: "r" });
    seedRule(teamPath, {
      wrong_pattern: "team-rule",
      correct_pattern: "t-c",
      reasoning: "r",
      scope: { level: "team" },
    });
    seedRule(globalPath, {
      wrong_pattern: "global-rule",
      correct_pattern: "g-c",
      reasoning: "r",
      scope: { level: "global" },
    });

    expect(
      handlePreToolUse(
        makeInput({ tool_input: { command: "use personal-rule here" } }),
        { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
      ).systemMessage,
    ).toContain("p-c");

    expect(
      handlePreToolUse(
        makeInput({ tool_input: { command: "use team-rule here" } }),
        { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
      ).systemMessage,
    ).toContain("t-c");

    expect(
      handlePreToolUse(
        makeInput({ tool_input: { command: "use global-rule here" } }),
        { personalPath, teamPath, globalPath, eventsPath, now: () => "2026-04-14T00:00:00Z" },
      ).systemMessage,
    ).toContain("g-c");
  });
});
