import { describe, it, expect } from "vitest";
import { buildMigrationPrompt, shouldResurrectDormant } from "../commands/migrate-v6.js";

describe("migrate-v6 helpers", () => {
  it("buildMigrationPrompt includes all 4 source fields", () => {
    const p = buildMigrationPrompt({
      trigger: "T", wrong_pattern: "W", correct_pattern: "C", reasoning: "R",
    });
    expect(p).toContain("T");
    expect(p).toContain("W");
    expect(p).toContain("C");
    expect(p).toContain("R");
  });

  it("resurrects dormant rules with hit_count >= 3", () => {
    expect(shouldResurrectDormant({ status: "dormant", hit_count: 3 })).toBe(true);
    expect(shouldResurrectDormant({ status: "dormant", hit_count: 2 })).toBe(false);
    expect(shouldResurrectDormant({ status: "active", hit_count: 100 })).toBe(false);
  });
});
