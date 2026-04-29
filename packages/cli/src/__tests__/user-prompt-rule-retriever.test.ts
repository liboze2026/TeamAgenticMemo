import { describe, it, expect } from "vitest";
import { formatRuleInjection, buildTechStackText, buildTerminalSummary } from "../user-prompt-rule-retriever.js";
import type { KnowledgeEntry } from "@teamagent/types";

function makeRule(id: string, trigger: string, correct: string, conf = 0.9): KnowledgeEntry {
  return {
    id,
    scope: { level: "global" },
    category: "S" as const,
    tags: [],
    type: "practice" as const,
    nature: "subjective" as const,
    trigger,
    wrong_pattern: "",
    correct_pattern: correct,
    reasoning: "test",
    confidence: conf,
    enforcement: "suggest" as const,
    status: "active" as const,
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-01-01T00:00:00Z",
    last_hit_at: "",
    last_validated_at: "2026-01-01T00:00:00Z",
    source: "preset",
    conflict_with: [],
    current_tier: "canonical" as const,
    max_tier_ever: "canonical" as const,
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    channel: "passive-knowledge" as const,
  } as KnowledgeEntry;
}

describe("formatRuleInjection", () => {
  it("returns empty string for empty rules array", () => {
    expect(formatRuleInjection([], "T2")).toBe("");
  });

  it("includes header with tier label", () => {
    const rules = [makeRule("r1", "开始实现功能时", "先写测试")];
    const text = formatRuleInjection(rules, "T1");
    expect(text).toContain("T1");
    expect(text).toContain("TeamAgent");
  });

  it("includes each rule's trigger and correct_pattern", () => {
    const rules = [
      makeRule("r1", "开始实现功能时", "先写测试"),
      makeRule("r2", "提交代码时", "一次一件事"),
    ];
    const text = formatRuleInjection(rules, "T2");
    expect(text).toContain("先写测试");
    expect(text).toContain("一次一件事");
  });
});

describe("buildTerminalSummary", () => {
  it("returns empty string when no rules", () => {
    expect(buildTerminalSummary([], [])).toBe("");
  });

  it("includes ASCII block header with count", () => {
    const rules = [makeRule("r1", "调用外部 HTTP API 时", "fetch + 错误处理")];
    const text = buildTerminalSummary(rules, []);
    expect(text).toContain("========|| TeamAgent ||========");
    expect(text).toContain("1");
  });

  it("lists each rule's trigger and correct_pattern", () => {
    const r1 = makeRule("r1", "调用外部 HTTP API 时", "fetch");
    const r2 = makeRule("r2", "git push 到主分支", "PR 流程");
    const text = buildTerminalSummary([r1], [r2]);
    expect(text).toContain("调用外部 HTTP API 时");
    expect(text).toContain("fetch");
    expect(text).toContain("git push 到主分支");
    expect(text).toContain("PR 流程");
  });

  it("combines tier1 and tier2 rules", () => {
    const t1 = [makeRule("r1", "触发1", "做法1")];
    const t2 = [makeRule("r2", "触发2", "做法2")];
    const text = buildTerminalSummary(t1, t2);
    expect(text).toContain("2");
    expect(text).toContain("触发1");
    expect(text).toContain("触发2");
  });

  it("uses at most three lines", () => {
    const rules = [
      makeRule("r1", "调用外部 HTTP API 时", "fetch"),
      makeRule("r2", "git push 到主分支", "PR 流程"),
      makeRule("r3", "提交代码时", "一次一件事"),
    ];
    const text = buildTerminalSummary(rules, []);
    expect(text.split("\n")).toHaveLength(3);
    expect(text.split("\n")[1]).toMatch(/^\|\| .* \|\|$/);
  });
});

describe("buildTechStackText", () => {
  it("returns a non-empty string given a real cwd", () => {
    const text = buildTechStackText(process.cwd());
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});
