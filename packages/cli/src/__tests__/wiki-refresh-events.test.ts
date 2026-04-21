import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryAttributionBus } from "@teamagent/adapters";
import { runWikiRefresh } from "../wiki-refresh.js";

describe("runWikiRefresh — AttributionBus events", () => {
  let cwd: string;
  let bus: InMemoryAttributionBus;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "wiki-ev-"));
    bus = new InMemoryAttributionBus();
  });
  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("debounced 时 emit wiki-refresh/skipped", async () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(
      join(cwd, ".teamagent", "wiki-last-pull.json"),
      JSON.stringify({ attemptedAt: new Date().toISOString(), added: 0, archived: 0 }),
    );
    await runWikiRefresh({ cwd, force: false, bus });
    const events = bus.drain();
    const actions = events.map((e) => `${e.source}/${e.action}`);
    expect(actions).toContain("wiki-refresh/skipped");
  });

  it("成功跑 pipeline+sweep 时 emit started + completed + archived", async () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    await runWikiRefresh({
      cwd,
      force: true,
      bus,
      _testDeps: {
        openDb: () => ({ close: () => {} } as any),
        runPipeline: async () => ({ added: 2, skipped: 0, rejected: 0, errors: [] }),
        runSweep: () => ({ archived: [{ knowledgeId: "x", reason: "zero-hit-aged" as const }], byReason: { zeroHitAged: 1, sourceOverflow: 0 } }),
      },
    });
    const actions = bus.drain().map((e) => `${e.source}/${e.action}`);
    expect(actions).toContain("wiki-refresh/started");
    expect(actions).toContain("wiki-refresh/completed");
    expect(actions).toContain("wiki-refresh/archived");
  });
});
