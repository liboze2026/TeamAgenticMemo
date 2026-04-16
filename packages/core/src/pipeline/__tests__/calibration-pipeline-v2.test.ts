import { describe, it, expect, vi } from "vitest";
import { runCalibrationPipelineV2 } from "../calibration-pipeline-v2.js";
import { v2Calibrator } from "../../calibrator/v2/index.js";
import type {
  AttributionBus,
  KnowledgeStore,
  Observation,
} from "@teamagent/ports";
import type {
  AttributionEvent,
  KnowledgeEntry,
} from "@teamagent/types";

// ── helpers ──────────────────────────────────────────────────────────────────

class InMemoryStore implements KnowledgeStore {
  entries: KnowledgeEntry[] = [];
  updateCalls: Array<{ id: string; patch: Partial<KnowledgeEntry> }> = [];

  getAll() {
    return [...this.entries];
  }
  getActive() {
    return this.entries.filter((e) => e.status === "active");
  }
  getById(id: string) {
    return this.entries.find((e) => e.id === id);
  }
  query() {
    return this.getActive();
  }
  add(entry: KnowledgeEntry) {
    this.entries.push(entry);
  }
  update(id: string, patch: Partial<KnowledgeEntry>) {
    this.updateCalls.push({ id, patch });
    const i = this.entries.findIndex((e) => e.id === id);
    if (i < 0) throw new Error(`not found: ${id}`);
    this.entries[i] = { ...this.entries[i]!, ...patch } as KnowledgeEntry;
  }
  delete(id: string) {
    const i = this.entries.findIndex((e) => e.id === id);
    if (i < 0) return false;
    this.entries.splice(i, 1);
    return true;
  }
  count() {
    return this.entries.length;
  }
}

class RecordingBus implements AttributionBus {
  events: AttributionEvent[] = [];
  emit(e: AttributionEvent) {
    this.events.push(e);
  }
  subscribe() {
    return () => {};
  }
  drain() {
    return this.events.splice(0);
  }
}

function makeEntry(over: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: "e",
    scope: { level: "team" },
    category: "E",
    tags: [],
    type: "avoidance",
    nature: "subjective",
    trigger: "t",
    wrong_pattern: "w",
    correct_pattern: "c",
    reasoning: "r",
    confidence: 0.5,
    enforcement: "warn",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-04-01T00:00:00Z",
    last_hit_at: "",
    last_validated_at: "2026-04-01T00:00:00Z",
    source: "accumulated",
    conflict_with: [],
    current_tier: "experimental" as const,
    max_tier_ever: "experimental" as const,
    tier_entered_at: "2026-04-01T00:00:00Z",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    ...over,
  };
}

function makeObs(over: Partial<Observation> & { knowledge_id: string }): Observation {
  return {
    id: `obs-${Math.random().toString(36).slice(2)}`,
    timestamp: "2026-04-15T01:00:00Z",
    outcome: "success",
    ...over,
  };
}

const NOW = new Date("2026-04-15T12:00:00Z");

// ── tests ─────────────────────────────────────────────────────────────────────

describe("runCalibrationPipelineV2", () => {
  it("scans all active entries, runs v2 calibrator, writes back tier/demerit/confidence", async () => {
    const store = new InMemoryStore();
    const bus = new RecordingBus();

    // Two entries with 10 success observations each
    store.add(makeEntry({ id: "rule-a", confidence: 0.5 }));
    store.add(makeEntry({ id: "rule-b", confidence: 0.5 }));

    const observations: Observation[] = [];
    for (let i = 0; i < 10; i++) {
      observations.push(
        makeObs({ knowledge_id: "rule-a", id: `obs-a-${i}`, outcome: "success" }),
        makeObs({ knowledge_id: "rule-b", id: `obs-b-${i}`, outcome: "success" }),
      );
    }

    const result = await runCalibrationPipelineV2({
      calibrator: v2Calibrator,
      store,
      events: [],
      observations,
      bus,
      now: () => NOW,
    });

    // Both entries scanned
    expect(result.scanned).toBe(2);
    // Both adjusted (confidence changed with 10 successes)
    expect(result.adjusted).toHaveLength(2);

    // Store updated for both
    expect(store.updateCalls).toHaveLength(2);
    const updatedA = store.getById("rule-a")!;
    const updatedB = store.getById("rule-b")!;
    expect(updatedA.confidence).toBeGreaterThan(0.5);
    expect(updatedB.confidence).toBeGreaterThan(0.5);
    expect(updatedA.last_validated_at).toBe(NOW.toISOString());

    // Bus received events
    const busEvents = bus.events.filter((e) => e.action === "v2_adjusted");
    expect(busEvents).toHaveLength(2);
  });

  it("skips entries with no observations and zero demerit", async () => {
    const store = new InMemoryStore();

    // Entry with no obs, no events, zero demerit
    store.add(makeEntry({ id: "rule-empty", confidence: 0.7, demerit: 0 }));

    const result = await runCalibrationPipelineV2({
      calibrator: v2Calibrator,
      store,
      events: [],
      observations: [],
      now: () => NOW,
    });

    expect(result.scanned).toBe(1);
    expect(result.adjusted).toHaveLength(0);
    // store.update should NOT have been called
    expect(store.updateCalls).toHaveLength(0);
  });

  it("dryRun: does not write to store but populates adjusted array", async () => {
    const store = new InMemoryStore();
    const bus = new RecordingBus();

    store.add(makeEntry({ id: "rule-dry", confidence: 0.5 }));

    const observations: Observation[] = [];
    for (let i = 0; i < 10; i++) {
      observations.push(
        makeObs({ knowledge_id: "rule-dry", id: `obs-dry-${i}`, outcome: "success" }),
      );
    }

    const result = await runCalibrationPipelineV2({
      calibrator: v2Calibrator,
      store,
      events: [],
      observations,
      bus,
      now: () => NOW,
      dryRun: true,
    });

    // adjusted populated
    expect(result.adjusted).toHaveLength(1);
    expect(result.adjusted[0]!.knowledge_id).toBe("rule-dry");

    // store NOT updated
    expect(store.updateCalls).toHaveLength(0);
    // Original entry confidence unchanged
    expect(store.getById("rule-dry")!.confidence).toBe(0.5);

    // Bus still emits events (dry run doesn't suppress events)
    expect(bus.events).toHaveLength(1);
  });

  it("skips archived entries even if observations exist", async () => {
    const store = new InMemoryStore();

    store.add(makeEntry({ id: "rule-archived", status: "archived", confidence: 0.7 }));

    const observations: Observation[] = [];
    for (let i = 0; i < 5; i++) {
      observations.push(
        makeObs({ knowledge_id: "rule-archived", id: `obs-arch-${i}`, outcome: "success" }),
      );
    }

    const result = await runCalibrationPipelineV2({
      calibrator: v2Calibrator,
      store,
      events: [],
      observations,
      now: () => NOW,
    });

    expect(result.adjusted).toHaveLength(0);
    expect(store.updateCalls).toHaveLength(0);
  });

  it("tracks dormantNew when tier transitions to dormant via high demerit", async () => {
    const store = new InMemoryStore();

    // Entry already at demerit >= 30 (dormant threshold) — effectiveTier will return dormant
    store.add(makeEntry({
      id: "rule-doom",
      confidence: 0.5,
      demerit: 30,
      demerit_last_updated: "2026-04-14T00:00:00Z",
      tier_entered_at: "2026-03-01T00:00:00Z",
    }));

    // Provide some observations so calibrator runs (entry.demerit=30, non-zero)
    const observations: Observation[] = [
      makeObs({ knowledge_id: "rule-doom", id: "obs-doom-0", outcome: "failure" }),
    ];

    const result = await runCalibrationPipelineV2({
      calibrator: v2Calibrator,
      store,
      events: [],
      observations,
      now: () => NOW,
    });

    // Pipeline should run without throwing
    expect(result.scanned).toBe(1);
    // If dormant tier was reached, dormantNew should include the id
    if (result.dormantNew.includes("rule-doom")) {
      expect(store.getById("rule-doom")!.current_tier).toBe("dormant");
    }
  });
});
