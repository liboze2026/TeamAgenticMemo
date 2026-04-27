import { describe, it, expect } from "vitest";
import { formatRuleInjection, buildTechStackText } from "../user-prompt-rule-retriever.js";
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

describe("buildTechStackText", () => {
  it("returns a non-empty string given a real cwd", () => {
    const text = buildTechStackText(process.cwd());
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});
