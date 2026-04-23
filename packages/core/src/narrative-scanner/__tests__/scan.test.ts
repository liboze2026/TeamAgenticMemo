import { describe, it, expect } from "vitest";
import { scanNarrative } from "../scan.js";
import type { KnowledgeEntry } from "@teamagent/types";

function makeRule(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: "n1",
    scope: { level: "personal" },
    category: "K",
    tags: [],
    type: "avoidance",
    nature: "subjective",
    trigger: "",
    wrong_pattern: "claims-victory-phrase",
    correct_pattern: "back with evidence",
    reasoning: "AI must cite verification output",
    confidence: 0.9,
    enforcement: "warn",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-04-23T00:00:00Z",
    last_hit_at: "",
    last_validated_at: "",
    source: "accumulated",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    channel: "ai-narrative",
    ...overrides,
  };
}

describe("scanNarrative", () => {
  it("returns empty for empty text", () => {
    expect(scanNarrative("", [makeRule()])).toEqual([]);
  });

  it("returns empty for empty rules", () => {
    expect(scanNarrative("some ai output", [])).toEqual([]);
  });

  it("single match captures knowledge_id and snippet", () => {
    const hits = scanNarrative(
      "I already claims-victory-phrase on this task.",
      [makeRule({ id: "n1", wrong_pattern: "claims-victory-phrase" })],
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].knowledge_id).toBe("n1");
    expect(hits[0].matched_snippet).toContain("claims-victory-phrase");
    expect(hits[0].rule_summary).toBeTruthy();
  });

  it("multiple rules hit independently", () => {
    const hits = scanNarrative(
      "claims-victory-phrase and waiting-for-ping here",
      [
        makeRule({ id: "n1", wrong_pattern: "claims-victory-phrase" }),
        makeRule({ id: "n2", wrong_pattern: "waiting-for-ping" }),
      ],
    );
    expect(hits.map((h) => h.knowledge_id).sort()).toEqual(["n1", "n2"]);
  });

  it("case-insensitive substring matching", () => {
    const hits = scanNarrative("DONE.", [
      makeRule({ wrong_pattern: "done" }),
    ]);
    expect(hits).toHaveLength(1);
  });

  it("tool-action channel rules are excluded", () => {
    const hits = scanNarrative("claims-victory-phrase", [
      makeRule({ channel: "tool-action" }),
    ]);
    expect(hits).toHaveLength(0);
  });

  it("passive-knowledge channel rules are excluded", () => {
    const hits = scanNarrative("claims-victory-phrase", [
      makeRule({ channel: "passive-knowledge" }),
    ]);
    expect(hits).toHaveLength(0);
  });

  it("user-input channel rules are excluded", () => {
    const hits = scanNarrative("claims-victory-phrase", [
      makeRule({ channel: "user-input" }),
    ]);
    expect(hits).toHaveLength(0);
  });

  it("archived rules are skipped", () => {
    const hits = scanNarrative("claims-victory-phrase", [
      makeRule({ status: "archived" }),
    ]);
    expect(hits).toHaveLength(0);
  });

  it("empty wrong_pattern is skipped", () => {
    const hits = scanNarrative("some text", [
      makeRule({ wrong_pattern: "" }),
    ]);
    expect(hits).toHaveLength(0);
  });

  it("pipe-separated patterns: any token counts", () => {
    const hits = scanNarrative("the waiting-for-ping happened", [
      makeRule({ wrong_pattern: "claims-victory-phrase|waiting-for-ping" }),
    ]);
    expect(hits).toHaveLength(1);
  });

  it("pipe-separated with < 3 char tokens drops the short ones", () => {
    const hits = scanNarrative("okay here", [
      makeRule({ wrong_pattern: "a|b|okay" }),
    ]);
    expect(hits).toHaveLength(1);
  });

  it("one hit per rule even if multiple tokens match", () => {
    const hits = scanNarrative("claims-victory-phrase and waiting-for-ping", [
      makeRule({
        id: "combo",
        wrong_pattern: "claims-victory-phrase|waiting-for-ping",
      }),
    ]);
    expect(hits).toHaveLength(1);
  });

  it("performance: 50 rules, 10KB text, under 50ms", () => {
    const text = "lorem ipsum ".repeat(1000) + " claims-victory-phrase";
    const rules = Array.from({ length: 50 }, (_, i) =>
      makeRule({ id: `n${i}`, wrong_pattern: `pattern${i}` }),
    );
    rules.push(makeRule({ id: "target", wrong_pattern: "claims-victory-phrase" }));
    const start = performance.now();
    const hits = scanNarrative(text, rules);
    const elapsed = performance.now() - start;
    expect(hits.length).toBe(1);
    expect(elapsed).toBeLessThan(50);
  });
});
