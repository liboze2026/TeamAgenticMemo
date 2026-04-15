import { describe, it, expect } from "vitest";
import { runCalibratorContract } from "@teamagent/ports/contracts";
import { defaultCalibrator } from "../default.js";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

// --- Contract suite ---
describe("defaultCalibrator", () => {
  runCalibratorContract(() => defaultCalibrator);
});

// --- Implementation-specific table-driven tests ---

const baseEntry: KnowledgeEntry = {
  id: "rule-x",
  scope: { level: "team" },
  category: "E",
  tags: [],
  type: "avoidance",
  nature: "subjective",
  trigger: "t",
  wrong_pattern: "w",
  correct_pattern: "c",
  reasoning: "r",
  confidence: 0.7,
  enforcement: "warn",
  status: "active",
  hit_count: 0,
  success_count: 0,
  override_count: 0,
  evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
  created_at: "2026-04-15T00:00:00Z",
  last_hit_at: "",
  last_validated_at: "2026-04-15T00:00:00Z",
  source: "accumulated",
  conflict_with: [],
};

function pre(
  kind: "hook-pre.matched" | "hook-pre.warned" | "hook-pre.blocked",
  tool_use_id?: string,
  id = "p",
): PersistedEvent {
  return {
    id,
    kind,
    knowledge_id: "rule-x",
    tool_use_id,
    timestamp: "2026-04-15T01:00:00Z",
    schema_version: 1,
  };
}

function post(
  succeeded: boolean,
  tool_use_id: string,
  id = "post",
): PersistedEvent {
  return {
    id,
    kind: "hook-post.result",
    knowledge_id: "rule-x",
    tool_use_id,
    result: { succeeded },
    timestamp: "2026-04-15T01:01:00Z",
    schema_version: 1,
  };
}

describe("defaultCalibrator weights (M6 minimum)", () => {
  it.each([
    {
      name: "single hook-pre.blocked → +0.05",
      events: [pre("hook-pre.blocked", undefined, "b1")],
      expectedDelta: 0.05,
    },
    {
      name: "single hook-pre.warned → +0.02",
      events: [pre("hook-pre.warned", undefined, "w1")],
      expectedDelta: 0.02,
    },
    {
      name: "two blocked → +0.10",
      events: [
        pre("hook-pre.blocked", undefined, "b1"),
        pre("hook-pre.blocked", undefined, "b2"),
      ],
      expectedDelta: 0.1,
    },
    {
      name: "warned + post.success → +0.02 + 0.03",
      events: [pre("hook-pre.warned", "t1", "w1"), post(true, "t1", "ps1")],
      expectedDelta: 0.05,
    },
    {
      name: "blocked + post.fail → +0.05 - 0.10 = -0.05",
      events: [pre("hook-pre.blocked", "t1", "b1"), post(false, "t1", "pf1")],
      expectedDelta: -0.05,
    },
    {
      name: "matched only (no decision) → 0",
      events: [pre("hook-pre.matched", undefined, "m1")],
      expectedDelta: 0,
    },
  ])("$name", ({ events, expectedDelta }) => {
    const r = defaultCalibrator.calibrate(baseEntry, events);
    expect(r.delta).toBeCloseTo(expectedDelta, 5);
  });

  it("5-streak bonus: 5 success_after_fire (no fail) → extra +0.05", () => {
    const events: PersistedEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(pre("hook-pre.warned", `t${i}`, `w${i}`));
      events.push(post(true, `t${i}`, `ps${i}`));
    }
    const r = defaultCalibrator.calibrate(baseEntry, events);
    // 5 × 0.02 (warned) + 5 × 0.03 (success_after_fire) + 0.05 (bonus) = 0.30
    expect(r.delta).toBeCloseTo(0.3, 5);
    const bonusSig = r.applied_signals.find((s) => s.kind === "streak_bonus");
    expect(bonusSig).toBeDefined();
    expect(bonusSig!.weight).toBe(0.05);
  });

  it("no streak bonus if any fail present", () => {
    const events: PersistedEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(pre("hook-pre.warned", `t${i}`, `w${i}`));
      events.push(post(true, `t${i}`, `ps${i}`));
    }
    // Add one fail-after-block to break the streak
    events.push(pre("hook-pre.blocked", "tFail", "bFail"));
    events.push(post(false, "tFail", "pfFail"));
    const r = defaultCalibrator.calibrate(baseEntry, events);
    expect(r.applied_signals.find((s) => s.kind === "streak_bonus")).toBeUndefined();
  });

  it("auto-archive: active 0.32 + heavy negatives → archived", () => {
    const events: PersistedEvent[] = [];
    for (let i = 0; i < 3; i++) {
      events.push(pre("hook-pre.blocked", `t${i}`, `b${i}`));
      events.push(post(false, `t${i}`, `pf${i}`));
    }
    // 3 × +0.05 + 3 × -0.10 = -0.15; 0.32 - 0.15 = 0.17 < 0.3
    const r = defaultCalibrator.calibrate(
      { ...baseEntry, confidence: 0.32 },
      events,
    );
    expect(r.confidence).toBeCloseTo(0.17, 5);
    expect(r.status).toBe("archived");
  });

  it("does not archive when confidence stays >= 0.3", () => {
    const events: PersistedEvent[] = [];
    for (let i = 0; i < 1; i++) {
      events.push(pre("hook-pre.blocked", `t${i}`, `b${i}`));
      events.push(post(false, `t${i}`, `pf${i}`));
    }
    // 0.7 + 0.05 - 0.10 = 0.65
    const r = defaultCalibrator.calibrate(baseEntry, events);
    expect(r.status).toBe("active");
  });

  it("clamps to 1.0 max", () => {
    const events: PersistedEvent[] = Array.from({ length: 100 }, (_, i) =>
      pre("hook-pre.blocked", undefined, `b${i}`),
    );
    const r = defaultCalibrator.calibrate(
      { ...baseEntry, confidence: 0.95 },
      events,
    );
    expect(r.confidence).toBe(1);
  });

  it("clamps to 0.0 min (and archives)", () => {
    const events: PersistedEvent[] = [];
    for (let i = 0; i < 20; i++) {
      events.push(pre("hook-pre.blocked", `t${i}`, `b${i}`));
      events.push(post(false, `t${i}`, `pf${i}`));
    }
    const r = defaultCalibrator.calibrate(
      { ...baseEntry, confidence: 0.05 },
      events,
    );
    expect(r.confidence).toBe(0);
    expect(r.status).toBe("archived");
  });

  it("applied_signals breakdown is rendered correctly", () => {
    const events: PersistedEvent[] = [
      pre("hook-pre.blocked", "t1", "b1"),
      post(true, "t1", "ps1"),
    ];
    const r = defaultCalibrator.calibrate(baseEntry, events);
    const kinds = r.applied_signals.map((s) => s.kind).sort();
    expect(kinds).toEqual(["hook-pre.blocked", "post.success_after_fire"]);
  });
});
