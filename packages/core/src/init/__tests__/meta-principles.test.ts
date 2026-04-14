import { describe, it, expect } from "vitest";
import { getMetaPrinciples } from "../meta-principles.js";
import { KnowledgeEntrySchema } from "@teamagent/types";

describe("getMetaPrinciples", () => {
  it("returns exactly 4 entries", () => {
    expect(getMetaPrinciples()).toHaveLength(4);
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
      expect(entry.enforcement).toBe("suggest");
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
