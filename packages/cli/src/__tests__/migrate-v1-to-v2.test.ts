import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeMigrate } from "../commands/migrate-v1-to-v2.js";

let tmpHome: string;
let tmpCwd: string;

function mkPhase1Entry(id: string, extra: Record<string, unknown> = {}): any {
  return {
    id,
    scope: { level: "personal" },
    category: "E",
    tags: ["phase1"],
    type: "avoidance",
    nature: "subjective",
    trigger: "trigger-" + id,
    wrong_pattern: "w-" + id,
    correct_pattern: "c-" + id,
    reasoning: "r-" + id,
    confidence: 0.6,
    enforcement: "warn",
    status: "active",
    hit_count: 5,
    success_count: 3,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-04-01T00:00:00Z",
    last_hit_at: "2026-04-10T00:00:00Z",
    last_validated_at: "2026-04-01T00:00:00Z",
    source: "accumulated",
    conflict_with: [],
    ...extra,
  };
}

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "teamagent-migrate-home-"));
  tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "teamagent-migrate-cwd-"));

  const personalPath = path.join(tmpHome, ".teamagent", "personal", "knowledge.jsonl");
  const teamPath = path.join(tmpCwd, ".teamagent", "knowledge.jsonl");
  const globalPath = path.join(tmpHome, ".teamagent", "global", "knowledge.jsonl");

  fs.mkdirSync(path.dirname(personalPath), { recursive: true });
  fs.mkdirSync(path.dirname(teamPath), { recursive: true });
  fs.mkdirSync(path.dirname(globalPath), { recursive: true });

  fs.writeFileSync(personalPath, [
    JSON.stringify(mkPhase1Entry("r-p1")),
    JSON.stringify(mkPhase1Entry("r-p2")),
  ].join("\n") + "\n");

  fs.writeFileSync(teamPath, JSON.stringify(mkPhase1Entry("r-t1", { scope: { level: "team" }})) + "\n");

  fs.writeFileSync(globalPath, JSON.stringify(mkPhase1Entry("r-g1", { scope: { level: "global" }})) + "\n");
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpCwd, { recursive: true, force: true });
});

describe("executeMigrate", () => {
  it("reads Phase 1 JSONL from all 3 locations", async () => {
    const r = await executeMigrate({ homeDir: tmpHome, cwd: tmpCwd, dryRun: true });
    expect(r.readEntries).toBeGreaterThanOrEqual(4);
    expect(r.byScope.personal).toBe(2);
    expect(r.byScope.team).toBe(1);
    expect(r.byScope.global).toBe(1);
  });

  it("dry-run does not write to SQLite", async () => {
    await executeMigrate({ homeDir: tmpHome, cwd: tmpCwd, dryRun: true });
    const newDbPath = path.join(tmpCwd, ".teamagent", "knowledge.db");
    expect(fs.existsSync(newDbPath)).toBe(false);
  });

  it("handles empty / missing JSONL gracefully", async () => {
    fs.rmSync(path.join(tmpHome, ".teamagent", "personal", "knowledge.jsonl"));
    const r = await executeMigrate({ homeDir: tmpHome, cwd: tmpCwd, dryRun: true });
    expect(r.readEntries).toBeGreaterThanOrEqual(2);
    expect(r.byScope.personal).toBe(0);
  });
});
