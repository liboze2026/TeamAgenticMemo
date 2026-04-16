import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DualLayerStore } from "../dual-layer-store.js";

let tmpDir: string;
let store: DualLayerStore;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "teamagent-dual-"));
  store = new DualLayerStore({
    projectDbPath: path.join(tmpDir, "project.db"),
    userGlobalDbPath: path.join(tmpDir, "global.db"),
  });
});

afterEach(() => {
  store.close();
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function mkEntry(id: string, level: "personal" | "global"): any {
  return {
    id, scope: { level }, category: "E", tags: [],
    type: "avoidance", nature: "subjective",
    trigger: "t", wrong_pattern: "w", correct_pattern: "c", reasoning: "r",
    confidence: 0, enforcement: "passive", status: "active",
    hit_count: 0, success_count: 0, override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-04-15T00:00:00Z", last_hit_at: "",
    last_validated_at: "2026-04-15T00:00:00Z",
    source: "accumulated", conflict_with: [],
  };
}

describe("DualLayerStore", () => {
  it("personal → project DB, global → user-global DB", () => {
    store.add(mkEntry("p1", "personal"));
    store.add(mkEntry("g1", "global"));

    expect(store.getProjectStore().getById("p1")?.id).toBe("p1");
    expect(store.getProjectStore().getById("g1")).toBeUndefined();

    expect(store.getGlobalStore().getById("g1")?.id).toBe("g1");
    expect(store.getGlobalStore().getById("p1")).toBeUndefined();
  });

  it("findActive merges both layers", () => {
    store.add(mkEntry("p1", "personal"));
    store.add(mkEntry("p2", "personal"));
    store.add(mkEntry("g1", "global"));
    const all = store.findActive();
    expect(all).toHaveLength(3);
    expect(all.map(e => e.id).sort()).toEqual(["g1", "p1", "p2"]);
  });

  it("getById checks project first then global", () => {
    store.add(mkEntry("only-p", "personal"));
    store.add(mkEntry("only-g", "global"));
    expect(store.getById("only-p")?.id).toBe("only-p");
    expect(store.getById("only-g")?.id).toBe("only-g");
    expect(store.getById("nope")).toBeUndefined();
  });

  it("throws when team-scoped entry added (Phase 4 only)", () => {
    expect(() => store.add(mkEntry("t1", "team" as any))).toThrow(/team.*phase 4|not supported/i);
  });
});
