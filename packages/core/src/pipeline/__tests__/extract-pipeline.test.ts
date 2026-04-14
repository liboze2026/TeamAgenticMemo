import { describe, it, expect, beforeEach } from "vitest";
import {
  runExtractPipeline,
  formatCorrectionContext,
  type ExtractPipelineDeps,
} from "../extract-pipeline.js";
import type {
  CorrectionDetector,
  CorrectionMoment,
  KnowledgeExtractor,
  KnowledgeStore,
  AttributionBus,
} from "@teamagent/ports";
import type {
  AttributionEvent,
  KnowledgeEntry,
  ParsedSession,
  Scope,
} from "@teamagent/types";

// ---------- Test doubles ----------

function makeSession(): ParsedSession {
  return {
    sessionId: "test-session",
    startTime: "2026-04-14T00:00:00Z",
    endTime: "2026-04-14T01:00:00Z",
    turns: [],
  };
}

function makeMoment(overrides: Partial<CorrectionMoment> = {}): CorrectionMoment {
  return {
    signal: "explicit_denial",
    weight: 0.95,
    turnIndex: 1,
    correctionText: "不用 axios，用 fetch",
    previousAssistantText: "建议用 axios 发请求",
    previousToolCalls: ["Write(path)"],
    timestamp: "2026-04-14T00:00:00Z",
    ...overrides,
  };
}

class StubDetector implements CorrectionDetector {
  constructor(public moments: CorrectionMoment[]) {}
  detect(_: ParsedSession): CorrectionMoment[] {
    return this.moments;
  }
}

/** Mock extractor driven by a queue of behaviors. */
class QueuedExtractor implements KnowledgeExtractor {
  constructor(
    public behaviors: Array<
      | { kind: "ok"; partial: Partial<KnowledgeEntry> }
      | { kind: "null" }
      | { kind: "throw"; message: string }
    >,
  ) {}
  async extract(): Promise<Partial<KnowledgeEntry> | null> {
    const next = this.behaviors.shift();
    if (!next) throw new Error("extractor queue exhausted");
    if (next.kind === "null") return null;
    if (next.kind === "throw") throw new Error(next.message);
    return next.partial;
  }
}

class InMemoryStoreStub implements KnowledgeStore {
  entries: KnowledgeEntry[] = [];
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
    if (this.entries.some((e) => e.id === entry.id)) {
      throw new Error("duplicate id");
    }
    this.entries.push(entry);
  }
  update(id: string, patch: Partial<KnowledgeEntry>) {
    const i = this.entries.findIndex((e) => e.id === id);
    if (i < 0) throw new Error("not found");
    this.entries[i] = { ...this.entries[i]!, ...patch };
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

const SCOPE: Scope = { level: "team" };

function makeDeps(
  overrides: Partial<ExtractPipelineDeps> = {},
): ExtractPipelineDeps {
  let counter = 0;
  return {
    detector: new StubDetector([]),
    extractor: new QueuedExtractor([]),
    callLLM: async () => "",
    store: new InMemoryStoreStub(),
    scope: SCOPE,
    now: () => new Date("2026-04-14T12:00:00Z"),
    idGen: () => `test-${++counter}`,
    ...overrides,
  };
}

// ---------- Tests ----------

describe("runExtractPipeline", () => {
  it("extracts one correction into a full KnowledgeEntry", async () => {
    const deps = makeDeps({
      detector: new StubDetector([makeMoment()]),
      extractor: new QueuedExtractor([
        {
          kind: "ok",
          partial: {
            category: "E",
            tags: ["http-client"],
            type: "avoidance",
            nature: "subjective",
            trigger: "需要发起 HTTP 请求",
            wrong_pattern: "axios",
            correct_pattern: "fetch",
            reasoning: "零依赖偏好",
          },
        },
      ]),
      store: new InMemoryStoreStub(),
    });

    const result = await runExtractPipeline(makeSession(), deps);

    expect(result.correctionsFound).toBe(1);
    expect(result.extracted).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);

    const entry = result.extracted[0]!;
    expect(entry.id).toBe("test-1");
    expect(entry.scope).toEqual(SCOPE);
    expect(entry.category).toBe("E");
    expect(entry.wrong_pattern).toBe("axios");
    expect(entry.correct_pattern).toBe("fetch");
    expect(entry.confidence).toBe(0.95);
    // subjective + confidence>=0.9 → warn (subjective caps at warn)
    expect(entry.enforcement).toBe("warn");
    expect(entry.source).toBe("accumulated");
    expect(entry.evidence.correction_sessions).toBe(1);
    expect(entry.created_at).toBe("2026-04-14T12:00:00.000Z");
    expect(entry.status).toBe("active");

    expect((deps.store as InMemoryStoreStub).entries).toHaveLength(1);
  });

  it("objective + high confidence → block enforcement", async () => {
    const deps = makeDeps({
      detector: new StubDetector([makeMoment()]),
      extractor: new QueuedExtractor([
        {
          kind: "ok",
          partial: {
            category: "C",
            type: "avoidance",
            nature: "objective",
            trigger: "trigger",
            correct_pattern: "correct",
            reasoning: "r",
          },
        },
      ]),
    });
    const r = await runExtractPipeline(makeSession(), deps);
    expect(r.extracted[0]!.enforcement).toBe("block");
  });

  it("null extraction → skipped, store untouched", async () => {
    const store = new InMemoryStoreStub();
    const deps = makeDeps({
      detector: new StubDetector([makeMoment(), makeMoment({ turnIndex: 3 })]),
      extractor: new QueuedExtractor([{ kind: "null" }, { kind: "null" }]),
      store,
    });
    const r = await runExtractPipeline(makeSession(), deps);
    expect(r.skipped).toBe(2);
    expect(r.extracted).toHaveLength(0);
    expect(store.entries).toHaveLength(0);
  });

  it("extractor throws → counted as failed, continues to next", async () => {
    const deps = makeDeps({
      detector: new StubDetector([
        makeMoment({ turnIndex: 1 }),
        makeMoment({ turnIndex: 3 }),
      ]),
      extractor: new QueuedExtractor([
        { kind: "throw", message: "rate-limited" },
        {
          kind: "ok",
          partial: {
            category: "E",
            type: "avoidance",
            nature: "subjective",
            trigger: "t",
            correct_pattern: "c",
            reasoning: "r",
          },
        },
      ]),
    });
    const r = await runExtractPipeline(makeSession(), deps);
    expect(r.failed).toBe(1);
    expect(r.extracted).toHaveLength(1);
  });

  it("emits extractor events with human-readable values", async () => {
    const bus = new RecordingBus();
    const deps = makeDeps({
      detector: new StubDetector([
        makeMoment({ turnIndex: 1 }),
        makeMoment({ turnIndex: 2 }),
      ]),
      extractor: new QueuedExtractor([
        {
          kind: "ok",
          partial: {
            category: "E",
            type: "avoidance",
            nature: "subjective",
            trigger: "用 HTTP",
            correct_pattern: "fetch",
            reasoning: "r",
          },
        },
        { kind: "null" },
      ]),
      bus,
    });
    await runExtractPipeline(makeSession(), deps);
    const actions = bus.events.map((e) => e.action);
    expect(actions).toContain("extracted");
    expect(actions).toContain("skipped");
    const extracted = bus.events.find((e) => e.action === "extracted")!;
    expect(extracted.userFacingValue).toContain("学到");
  });

  it("triggers recompile once at end with active entries", async () => {
    let recompileCalls: KnowledgeEntry[][] = [];
    const deps = makeDeps({
      detector: new StubDetector([
        makeMoment({ turnIndex: 1 }),
        makeMoment({ turnIndex: 2 }),
      ]),
      extractor: new QueuedExtractor([
        {
          kind: "ok",
          partial: {
            category: "E",
            type: "avoidance",
            nature: "subjective",
            trigger: "t1",
            correct_pattern: "c1",
            reasoning: "r",
          },
        },
        {
          kind: "ok",
          partial: {
            category: "E",
            type: "avoidance",
            nature: "subjective",
            trigger: "t2",
            correct_pattern: "c2",
            reasoning: "r",
          },
        },
      ]),
      recompile: (entries) => {
        recompileCalls.push(entries);
      },
    });
    await runExtractPipeline(makeSession(), deps);
    expect(recompileCalls).toHaveLength(1);
    expect(recompileCalls[0]).toHaveLength(2);
  });

  it("skips recompile when no dep provided", async () => {
    const deps = makeDeps({
      detector: new StubDetector([makeMoment()]),
      extractor: new QueuedExtractor([{ kind: "null" }]),
    });
    // must not throw
    const r = await runExtractPipeline(makeSession(), deps);
    expect(r.correctionsFound).toBe(1);
  });

  it("empty session → 0/0/0, no extractor calls", async () => {
    const extractor = new QueuedExtractor([]);
    const deps = makeDeps({ extractor });
    const r = await runExtractPipeline(makeSession(), deps);
    expect(r).toEqual({
      correctionsFound: 0,
      extracted: [],
      skipped: 0,
      failed: 0,
    });
  });

  it("respects injected scope and source", async () => {
    const deps = makeDeps({
      detector: new StubDetector([makeMoment()]),
      extractor: new QueuedExtractor([
        {
          kind: "ok",
          partial: {
            category: "E",
            type: "avoidance",
            nature: "subjective",
            trigger: "t",
            correct_pattern: "c",
            reasoning: "r",
          },
        },
      ]),
      scope: { level: "personal" },
      source: "team-shared",
    });
    const r = await runExtractPipeline(makeSession(), deps);
    expect(r.extracted[0]!.scope.level).toBe("personal");
    expect(r.extracted[0]!.source).toBe("team-shared");
  });
});

describe("formatCorrectionContext", () => {
  it("includes signal + weight + AI text + user text", () => {
    const s = formatCorrectionContext(makeMoment());
    expect(s).toContain("explicit_denial");
    expect(s).toContain("0.95");
    expect(s).toContain("axios");
    expect(s).toContain("fetch");
  });

  it("truncates long AI text to cap prompt size", () => {
    const huge = "x".repeat(2000);
    const s = formatCorrectionContext(
      makeMoment({ previousAssistantText: huge }),
    );
    expect(s.length).toBeLessThan(2000);
    expect(s).toContain("…");
  });

  it("omits tool-calls line when there are none", () => {
    const s = formatCorrectionContext(
      makeMoment({ previousToolCalls: [] }),
    );
    expect(s).not.toContain("AI 之前调用的工具");
  });
});
