import { describe, it, expect } from "vitest";
import {
  KnowledgeEntrySchema,
  computeEnforcement,
  type KnowledgeEntry,
} from "../knowledge-entry.js";

describe("KnowledgeEntrySchema v2 fields", () => {
  const baseValid = {
    id: "r1",
    scope: { level: "team" as const },
    category: "E" as const,
    tags: [],
    type: "avoidance" as const,
    nature: "subjective" as const,
    trigger: "t",
    correct_pattern: "c",
    reasoning: "r",
    confidence: 0.5,
    enforcement: "passive" as const,
    created_at: "2026-04-16T00:00:00Z",
    source: "accumulated" as const,
  };

  it("accepts entry with new v2 tier fields", () => {
    const parsed = KnowledgeEntrySchema.parse({
      ...baseValid,
      current_tier: "probation",
      max_tier_ever: "probation",
      tier_entered_at: "2026-04-16T00:00:00Z",
      demerit: 0,
      demerit_last_updated: "2026-04-16T00:00:00Z",
      resurrect_count: 0,
    });
    expect(parsed.current_tier).toBe("probation");
    expect(parsed.demerit).toBe(0);
  });

  it("defaults v2 fields when omitted (backward compat)", () => {
    const parsed = KnowledgeEntrySchema.parse(baseValid);
    expect(parsed.current_tier).toBe("experimental");
    expect(parsed.max_tier_ever).toBe("experimental");
    expect(parsed.demerit).toBe(0);
    expect(parsed.resurrect_count).toBe(0);
  });

  it("status accepts 'dormant'", () => {
    const parsed = KnowledgeEntrySchema.parse({ ...baseValid, status: "dormant" });
    expect(parsed.status).toBe("dormant");
  });

  it("current_tier enum rejects invalid value", () => {
    expect(() =>
      KnowledgeEntrySchema.parse({ ...baseValid, current_tier: "super-enforced" }),
    ).toThrow();
  });
});

describe("KnowledgeEntrySchema", () => {
  const validEntry: KnowledgeEntry = {
    id: "test-001",
    scope: { level: "personal" },
    category: "C",
    tags: ["syntax-error"],
    type: "avoidance",
    nature: "objective",
    trigger: "t",
    wrong_pattern: "",
    correct_pattern: "c",
    reasoning: "r",
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
    source: "preset",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
  };

  it("accepts a valid entry", () => {
    expect(() => KnowledgeEntrySchema.parse(validEntry)).not.toThrow();
  });

  it("rejects unknown category", () => {
    expect(() =>
      KnowledgeEntrySchema.parse({ ...validEntry, category: "X" }),
    ).toThrow();
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      KnowledgeEntrySchema.parse({ ...validEntry, confidence: 1.5 }),
    ).toThrow();
  });

  it("applies defaults for optional counters", () => {
    const { hit_count, success_count, override_count, conflict_with, ...rest } =
      validEntry;
    const parsed = KnowledgeEntrySchema.parse(rest);
    expect(parsed.hit_count).toBe(0);
    expect(parsed.success_count).toBe(0);
    expect(parsed.override_count).toBe(0);
    expect(parsed.conflict_with).toEqual([]);
  });
});

describe("computeEnforcement", () => {
  it("<0.5 → passive", () => {
    expect(computeEnforcement(0.3, "objective")).toBe("passive");
  });

  it("0.5-0.7 → suggest", () => {
    expect(computeEnforcement(0.6, "objective")).toBe("suggest");
  });

  it("0.7-0.9 → warn", () => {
    expect(computeEnforcement(0.8, "objective")).toBe("warn");
  });

  it("objective >= 0.9 → block", () => {
    expect(computeEnforcement(0.95, "objective")).toBe("block");
  });

  it("subjective >= 0.9 caps at warn", () => {
    expect(computeEnforcement(0.95, "subjective")).toBe("warn");
  });

  it("boundary at 0.9 exactly", () => {
    expect(computeEnforcement(0.9, "objective")).toBe("block");
    expect(computeEnforcement(0.9, "subjective")).toBe("warn");
  });
});
