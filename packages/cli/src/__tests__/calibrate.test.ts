import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nodeFs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  executeCalibrate,
  parseCalibrateArgs,
  renderCalibrateResult,
} from "../commands/calibrate.js";
import { JsonlEventLog, JsonlKnowledgeStore } from "@teamagent/adapters";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

function mkTmp() {
  const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), "cal-cli-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "cwd");
  nodeFs.mkdirSync(home, { recursive: true });
  nodeFs.mkdirSync(cwd, { recursive: true });
  return {
    home,
    cwd,
    teamPath: path.join(cwd, ".teamagent", "knowledge.jsonl"),
    personalPath: path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    globalPath: path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    eventsPath: path.join(home, ".teamagent", "events.jsonl"),
    claudeMdPath: path.join(cwd, "CLAUDE.md"),
    cleanup: () => nodeFs.rmSync(root, { recursive: true, force: true }),
  };
}

function seedEntry(storePath: string, e: KnowledgeEntry): void {
  new JsonlKnowledgeStore(storePath).add(e);
}

function entry(over: Partial<KnowledgeEntry>): KnowledgeEntry {
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
    ...over,
  };
}

function evt(over: Partial<PersistedEvent>): PersistedEvent {
  return {
    id: "evt",
    kind: "hook-pre.matched",
    timestamp: "2026-04-15T01:00:00Z",
    schema_version: 1,
    ...over,
  } as PersistedEvent;
}

describe("executeCalibrate", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => tmp.cleanup());

  it("no events → 0/0/0 across scopes", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a" }));
    const r = await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });
    expect(r.totalAdjusted).toBe(0);
    expect(r.totalArchived).toBe(0);
  });

  it("positive events → confidence raised + calibrator.adjusted event written", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a", confidence: 0.7 }));
    new JsonlEventLog(tmp.eventsPath).append(
      evt({ id: "p1", kind: "hook-pre.blocked", knowledge_id: "rule-a" }),
    );

    const r = await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });

    expect(r.totalAdjusted).toBe(1);
    // Store updated
    const updated = new JsonlKnowledgeStore(tmp.teamPath).getById("rule-a")!;
    expect(updated.confidence).toBeCloseTo(0.75, 5);
    // calibrator.adjusted event written
    const events = new JsonlEventLog(tmp.eventsPath).readAll();
    const cal = events.find((e) => e.kind === "calibrator.adjusted")!;
    expect(cal).toBeDefined();
    expect(cal.knowledge_id).toBe("rule-a");
    expect(cal.confidence_before).toBe(0.7);
    expect(cal.confidence_after).toBeCloseTo(0.75, 5);
  });

  it("dry-run does not modify store or write events", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a", confidence: 0.7 }));
    new JsonlEventLog(tmp.eventsPath).append(
      evt({ id: "p1", kind: "hook-pre.blocked", knowledge_id: "rule-a" }),
    );

    const r = await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      dryRun: true,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });
    expect(r.dryRun).toBe(true);
    expect(r.totalAdjusted).toBe(1); // 报告会调整 1 条
    // 但实际 store 未变
    const stillOriginal = new JsonlKnowledgeStore(tmp.teamPath).getById("rule-a")!;
    expect(stillOriginal.confidence).toBe(0.7);
    // events.jsonl 没新增 calibrator.adjusted
    const events = new JsonlEventLog(tmp.eventsPath).readAll();
    expect(events.some((e) => e.kind === "calibrator.adjusted")).toBe(false);
  });

  it("days filter excludes old events", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a", confidence: 0.7 }));
    // 8 天前的事件
    new JsonlEventLog(tmp.eventsPath).append(
      evt({
        id: "p-old",
        kind: "hook-pre.blocked",
        knowledge_id: "rule-a",
        timestamp: "2026-04-07T00:00:00Z",
      }),
    );
    const r = await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      days: 7,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });
    expect(r.totalAdjusted).toBe(0); // 8 天前的事件被过滤
  });

  it("auto-archive happens and is reflected in result", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a", confidence: 0.32 }));
    const log = new JsonlEventLog(tmp.eventsPath);
    for (let i = 0; i < 3; i++) {
      log.append(
        evt({
          id: `b${i}`,
          kind: "hook-pre.blocked",
          knowledge_id: "rule-a",
          tool_use_id: `t${i}`,
        }),
      );
      log.append(
        evt({
          id: `pf${i}`,
          kind: "hook-post.result",
          knowledge_id: "rule-a",
          tool_use_id: `t${i}`,
          result: { succeeded: false },
        }),
      );
    }
    const r = await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });
    expect(r.totalArchived).toBe(1);
    const updated = new JsonlKnowledgeStore(tmp.teamPath).getById("rule-a")!;
    expect(updated.status).toBe("archived");
    // calibrator.adjusted event records the archive transition
    const cal = new JsonlEventLog(tmp.eventsPath)
      .readAll()
      .find((e) => e.kind === "calibrator.adjusted")!;
    expect(cal.status_after).toBe("archived");
  });

  it("recompiles CLAUDE.md when adjustments occur", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a", confidence: 0.7 }));
    new JsonlEventLog(tmp.eventsPath).append(
      evt({ id: "p1", kind: "hook-pre.blocked", knowledge_id: "rule-a" }),
    );
    await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });
    const md = nodeFs.readFileSync(tmp.claudeMdPath, "utf-8");
    expect(md).toContain("TEAMAGENT:START");
  });

  it("missing events file → no error, no adjustments", async () => {
    seedEntry(tmp.teamPath, entry({ id: "rule-a" }));
    const r = await executeCalibrate({
      cwd: tmp.cwd,
      homeDir: tmp.home,
      now: () => new Date("2026-04-15T02:00:00Z"),
    });
    expect(r.totalAdjusted).toBe(0);
  });
});

describe("parseCalibrateArgs", () => {
  it("defaults", () => {
    expect(parseCalibrateArgs([])).toEqual({});
  });
  it("--dry-run", () => {
    expect(parseCalibrateArgs(["--dry-run"])).toEqual({ dryRun: true });
  });
  it("--days form", () => {
    expect(parseCalibrateArgs(["--days", "14"])).toEqual({ days: 14 });
    expect(parseCalibrateArgs(["--days=14"])).toEqual({ days: 14 });
  });
});

describe("renderCalibrateResult", () => {
  it("happy path renders summary", () => {
    const out = renderCalibrateResult({
      dryRun: false,
      totalAdjusted: 2,
      totalArchived: 0,
      byScope: [
        {
          scope: "personal",
          storePath: "/p",
          scanned: 5,
          adjustedCount: 2,
          archivedCount: 0,
          adjustments: [
            {
              knowledge_id: "rule-1",
              before: 0.7,
              after: 0.75,
              delta: 0.05,
              status_before: "active",
              status_after: "active",
              signals: [],
            },
            {
              knowledge_id: "rule-2",
              before: 0.7,
              after: 0.72,
              delta: 0.02,
              status_before: "active",
              status_after: "active",
              signals: [],
            },
          ],
        },
        {
          scope: "team",
          storePath: "/t",
          scanned: 10,
          adjustedCount: 0,
          archivedCount: 0,
          adjustments: [],
        },
        {
          scope: "global",
          storePath: "/g",
          scanned: 0,
          adjustedCount: 0,
          archivedCount: 0,
          adjustments: [],
        },
      ],
    });
    expect(out).toContain("TeamAgent Calibrate");
    expect(out).toContain("rule-1: 0.70 → 0.75");
    expect(out).toContain("总计: 2 条调整");
  });

  it("dry-run header present + footer note", () => {
    const out = renderCalibrateResult({
      dryRun: true,
      totalAdjusted: 0,
      totalArchived: 0,
      byScope: [],
    });
    expect(out).toContain("dry-run");
    expect(out).toContain("(dry-run，未写入)");
  });
});
