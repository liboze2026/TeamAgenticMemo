import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  executeStats,
  renderStats,
  aggregateConfidenceMovements,
} from "../commands/stats.js";
import { JsonlEventLog, JsonlKnowledgeStore } from "@teamagent/adapters";
import { executePitfall } from "../commands/pitfall.js";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

function mkTmp() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "stats-cwd-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "stats-home-"));
  return {
    cwd,
    home,
    cleanup: () => {
      fs.rmSync(cwd, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    },
  };
}

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: "e",
    scope: { level: "personal" },
    category: "C",
    tags: ["tag1"],
    type: "avoidance",
    nature: "objective",
    trigger: "t",
    wrong_pattern: "w",
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
    source: "accumulated",
    conflict_with: [],
    ...overrides,
  };
}

describe("renderStats (pure)", () => {
  it("empty state shows helper text", () => {
    const out = renderStats({ personal: [], team: [], global: [] });
    expect(out).toContain("尚无知识条目");
    expect(out).toContain("teamagent pitfall");
  });

  it("counts by category", () => {
    const out = renderStats({
      personal: [
        makeEntry({ id: "a", category: "C" }),
        makeEntry({ id: "b", category: "C" }),
        makeEntry({ id: "c", category: "E" }),
      ],
      team: [],
      global: [],
    });
    expect(out).toContain("C 代码层  2");
    expect(out).toContain("E 工程层  1");
    expect(out).toContain("S 策略层  0");
  });

  it("counts by scope", () => {
    const out = renderStats({
      personal: [makeEntry({ id: "p1" })],
      team: [makeEntry({ id: "t1", scope: { level: "team" } }), makeEntry({ id: "t2", scope: { level: "team" } })],
      global: [makeEntry({ id: "g1", scope: { level: "global" } })],
    });
    expect(out).toContain("personal  1");
    expect(out).toContain("team      2");
    expect(out).toContain("global    1");
  });

  it("reports archived count separately", () => {
    const out = renderStats({
      personal: [
        makeEntry({ id: "a1", status: "active" }),
        makeEntry({ id: "a2", status: "archived" }),
      ],
      team: [],
      global: [],
    });
    expect(out).toContain("活跃 1");
    expect(out).toContain("归档 1");
  });

  it("Top 5 hits section only shows entries with hit_count > 0", () => {
    const out = renderStats({
      personal: [
        makeEntry({ id: "h1", hit_count: 50, trigger: "POP" }),
        makeEntry({ id: "h2", hit_count: 3, trigger: "LESS" }),
        makeEntry({ id: "z", hit_count: 0 }),
      ],
      team: [],
      global: [],
    });
    expect(out).toContain("Top 2");
    expect(out).toContain("POP");
    expect(out).toContain("LESS");
  });

  it("no Top hits section when no entry has hits", () => {
    const out = renderStats({
      personal: [makeEntry({ hit_count: 0 })],
      team: [],
      global: [],
    });
    expect(out).not.toContain("Top");
  });

  it("recent N shows most recent by created_at", () => {
    const out = renderStats({
      personal: [
        makeEntry({ id: "old", created_at: "2026-03-01T00:00:00Z", trigger: "OLD" }),
        makeEntry({ id: "new", created_at: "2026-04-14T00:00:00Z", trigger: "NEW" }),
      ],
      team: [],
      global: [],
    });
    const newIdx = out.indexOf("NEW");
    const oldIdx = out.indexOf("OLD");
    expect(newIdx).toBeGreaterThan(-1);
    expect(oldIdx).toBeGreaterThan(-1);
    expect(newIdx).toBeLessThan(oldIdx);
  });
});

describe("executeStats (IO)", () => {
  let tmp: ReturnType<typeof mkTmp>;

  beforeEach(() => {
    tmp = mkTmp();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("missing stores → empty-state message", () => {
    const out = executeStats({ cwd: tmp.cwd, homeDir: tmp.home });
    expect(out).toContain("尚无知识条目");
  });

  it("reads from real JSONL and aggregates", () => {
    // Seed via pitfall
    executePitfall(
      { trigger: "t1", wrong: "w1", correct: "c1", reason: "r1", category: "C" },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => "2026-04-14T00:00:00Z", env: {} },
    );
    executePitfall(
      { trigger: "t2", wrong: "w2", correct: "c2", reason: "r2", category: "E" },
      { cwd: tmp.cwd, homeDir: tmp.home, now: () => "2026-04-14T01:00:00Z", env: {} },
    );

    const out = executeStats({ cwd: tmp.cwd, homeDir: tmp.home });
    expect(out).toContain("总数: 2");
    expect(out).toContain("C 代码层  1");
    expect(out).toContain("E 工程层  1");
    expect(out).toContain("t2"); // recent first
  });

  it("ignores corrupt JSONL file gracefully", () => {
    const corruptDir = path.join(tmp.home, ".teamagent", "personal");
    fs.mkdirSync(corruptDir, { recursive: true });
    const corruptFile = path.join(corruptDir, "knowledge.jsonl");
    fs.writeFileSync(corruptFile, "garbage\nnot json\n");

    const out = executeStats({ cwd: tmp.cwd, homeDir: tmp.home });
    // Corrupt lines skipped by JsonlStore; remaining count is 0
    expect(out).toContain("尚无知识条目");
  });

  describe("M6 confidence movements", () => {
    it("aggregateConfidenceMovements sums per-rule deltas in window", () => {
      const events: PersistedEvent[] = [
        {
          id: "1",
          kind: "calibrator.adjusted",
          knowledge_id: "rule-a",
          confidence_before: 0.7,
          confidence_after: 0.75,
          timestamp: "2026-04-15T01:00:00Z",
          schema_version: 1,
        },
        {
          id: "2",
          kind: "calibrator.adjusted",
          knowledge_id: "rule-a",
          confidence_before: 0.75,
          confidence_after: 0.8,
          timestamp: "2026-04-15T02:00:00Z",
          schema_version: 1,
        },
        {
          id: "3",
          kind: "calibrator.adjusted",
          knowledge_id: "rule-b",
          confidence_before: 0.5,
          confidence_after: 0.4,
          timestamp: "2026-04-15T03:00:00Z",
          schema_version: 1,
        },
      ];
      const movements = aggregateConfidenceMovements(
        events,
        7,
        new Date("2026-04-15T04:00:00Z"),
      );
      // sorted by |delta| desc; rule-a +0.10, rule-b -0.10 (tie → either order ok)
      const a = movements.find((m) => m.knowledge_id === "rule-a")!;
      const b = movements.find((m) => m.knowledge_id === "rule-b")!;
      expect(a.totalDelta).toBeCloseTo(0.1, 5);
      expect(b.totalDelta).toBeCloseTo(-0.1, 5);
    });

    it("aggregateConfidenceMovements ignores events outside window", () => {
      const events: PersistedEvent[] = [
        {
          id: "old",
          kind: "calibrator.adjusted",
          knowledge_id: "rule-old",
          confidence_before: 0.7,
          confidence_after: 0.9,
          timestamp: "2026-04-01T00:00:00Z",
          schema_version: 1,
        },
      ];
      const movements = aggregateConfidenceMovements(
        events,
        7,
        new Date("2026-04-15T00:00:00Z"),
      );
      expect(movements).toHaveLength(0);
    });

    it("aggregateConfidenceMovements skips non-calibrator events", () => {
      const events: PersistedEvent[] = [
        {
          id: "p",
          kind: "hook-pre.matched",
          knowledge_id: "rule-x",
          timestamp: "2026-04-15T01:00:00Z",
          schema_version: 1,
        },
      ];
      expect(
        aggregateConfidenceMovements(events, 7, new Date("2026-04-15T02:00:00Z")),
      ).toHaveLength(0);
    });

    it("flags archivedThisWindow when status_after=archived", () => {
      const events: PersistedEvent[] = [
        {
          id: "1",
          kind: "calibrator.adjusted",
          knowledge_id: "rule-x",
          confidence_before: 0.4,
          confidence_after: 0.25,
          status_after: "archived",
          timestamp: "2026-04-15T01:00:00Z",
          schema_version: 1,
        },
      ];
      const movements = aggregateConfidenceMovements(
        events,
        7,
        new Date("2026-04-15T02:00:00Z"),
      );
      expect(movements[0]!.archivedThisWindow).toBe(true);
    });

    it("renderStats includes top 5 confidence changes section when movements present", () => {
      const entry: KnowledgeEntry = makeEntry({
        id: "rule-a",
        trigger: "use HTTP client",
      });
      const movements = [
        {
          knowledge_id: "rule-a",
          totalDelta: 0.15,
          archivedThisWindow: false,
        },
      ];
      const out = renderStats(
        { personal: [entry], team: [], global: [] },
        movements,
        7,
      );
      expect(out).toContain("本周（7 天）confidence 变化");
      expect(out).toContain("+0.15");
      expect(out).toContain("rule-a");
      expect(out).toContain("use HTTP client");
    });

    it("renderStats omits movements section when empty", () => {
      const entry = makeEntry({ id: "rule-a" });
      const out = renderStats({ personal: [entry], team: [], global: [] }, []);
      expect(out).not.toContain("confidence 变化");
    });

    it("executeStats reads events.jsonl and shows movement section", () => {
      const eventsDir = path.join(tmp.home, ".teamagent");
      fs.mkdirSync(eventsDir, { recursive: true });
      const eventsPath = path.join(eventsDir, "events.jsonl");
      new JsonlEventLog(eventsPath).append({
        id: "c1",
        kind: "calibrator.adjusted",
        knowledge_id: "rule-x",
        confidence_before: 0.7,
        confidence_after: 0.75,
        timestamp: "2026-04-15T01:00:00Z",
        schema_version: 1,
      });
      // Need a knowledge entry too so stats has at least 1 entry
      const teamDir = path.join(tmp.cwd, ".teamagent");
      fs.mkdirSync(teamDir, { recursive: true });
      new JsonlKnowledgeStore(path.join(teamDir, "knowledge.jsonl")).add(
        makeEntry({ id: "rule-x", scope: { level: "team" } }),
      );

      const out = executeStats({
        cwd: tmp.cwd,
        homeDir: tmp.home,
        windowDays: 7,
        now: () => new Date("2026-04-15T02:00:00Z"),
      });
      expect(out).toContain("confidence 变化");
      expect(out).toContain("rule-x");
    });
  });
});
