import { describe, it, expect } from "vitest";
import { getMetaPrinciples } from "../meta-principles.js";
import { KnowledgeEntrySchema } from "@teamagent/types";

describe("getMetaPrinciples", () => {
  it("returns 6 entries (4 base meta + 2 canonical team rules)", () => {
    expect(getMetaPrinciples()).toHaveLength(6);
  });

  it("all entries validate against KnowledgeEntrySchema", () => {
    for (const entry of getMetaPrinciples()) {
      const result = KnowledgeEntrySchema.safeParse(entry);
      expect(
        result.success,
        `${entry.id} failed: ${result.success ? "" : JSON.stringify(result.error.issues)}`,
      ).toBe(true);
    }
  });

  it("all entries are source=preset, scope=global, type=practice", () => {
    for (const entry of getMetaPrinciples()) {
      expect(entry.source).toBe("preset");
      expect(entry.scope.level).toBe("global");
      expect(entry.type).toBe("practice");
    }
  });

  it("base meta principles (4) are enforcement=suggest", () => {
    const base = getMetaPrinciples().filter(
      (e) => !e.id.startsWith("preset-search-web") && !e.id.startsWith("preset-prefer-gstack"),
    );
    expect(base).toHaveLength(4);
    for (const e of base) expect(e.enforcement).toBe("suggest");
  });

  it("canonical team rules are high-confidence, tier=canonical, always-distributed", () => {
    const canon = getMetaPrinciples().filter(
      (e) => e.current_tier === "canonical",
    );
    expect(canon.length).toBeGreaterThanOrEqual(2);
    const ids = canon.map((e) => e.id);
    expect(ids).toContain("preset-search-web-before-trusting-memory");
    expect(ids).toContain("preset-prefer-gstack-tooling");
    for (const e of canon) {
      expect(e.confidence).toBeGreaterThanOrEqual(0.9);
      expect(e.enforcement).toBe("warn");
      expect(e.max_tier_ever).toBe("canonical");
      expect(e.status).toBe("active");
    }
  });

  it("ids are stable (don't change between calls)", () => {
    const a = getMetaPrinciples();
    const b = getMetaPrinciples();
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it("honors injected now()", () => {
    const fixed = new Date("2026-01-01T00:00:00Z");
    const [entry] = getMetaPrinciples(() => fixed);
    expect(entry!.created_at).toBe(fixed.toISOString());
    expect(entry!.last_validated_at).toBe(fixed.toISOString());
  });

  it("every entry has non-empty trigger/correct/reasoning", () => {
    for (const e of getMetaPrinciples()) {
      expect(e.trigger.length).toBeGreaterThan(0);
      expect(e.correct_pattern.length).toBeGreaterThan(0);
      expect(e.reasoning.length).toBeGreaterThan(0);
    }
  });
});
