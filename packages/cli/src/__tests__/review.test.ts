import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nodeFs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeReview, parseReviewArgs } from "../commands/review.js";
import type { KnowledgeEntry } from "@teamagent/types";

function mkTmp() {
  const dir = nodeFs.mkdtempSync(path.join(os.tmpdir(), "review-"));
  return {
    dir,
    cleanup: () => nodeFs.rmSync(dir, { recursive: true, force: true }),
  };
}

function makeEntry(over: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: "x",
    scope: { level: "team" },
    category: "E",
    tags: ["test"],
    type: "avoidance",
    nature: "subjective",
    trigger: "t",
    wrong_pattern: "",
    correct_pattern: "c",
    reasoning: "r",
    confidence: 0.7,
    enforcement: "warn",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: "2026-04-14T00:00:00Z",
    last_hit_at: "",
    last_validated_at: "2026-04-14T00:00:00Z",
    source: "accumulated",
    conflict_with: [],
    ...over,
  };
}

function writeStore(filePath: string, entries: KnowledgeEntry[]): void {
  nodeFs.mkdirSync(path.dirname(filePath), { recursive: true });
  nodeFs.writeFileSync(
    filePath,
    entries.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

describe("executeReview", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => tmp.cleanup());

  it("empty state → helpful message", () => {
    const out = executeReview({
      homeDir: tmp.dir,
      cwd: tmp.dir,
    });
    expect(out).toContain("(知识库为空)");
  });

  it("sorts by created_at desc across all scopes", () => {
    const teamPath = path.join(tmp.dir, ".teamagent", "knowledge.jsonl");
    const personalPath = path.join(
      tmp.dir,
      ".teamagent",
      "personal",
      "knowledge.jsonl",
    );
    writeStore(teamPath, [
      makeEntry({
        id: "t-old",
        trigger: "old-team",
        created_at: "2026-04-10T00:00:00Z",
      }),
      makeEntry({
        id: "t-new",
        trigger: "new-team",
        created_at: "2026-04-14T10:00:00Z",
      }),
    ]);
    writeStore(personalPath, [
      makeEntry({
        id: "p-mid",
        scope: { level: "personal" },
        trigger: "mid-personal",
        created_at: "2026-04-12T00:00:00Z",
      }),
    ]);

    const out = executeReview({
      homeDir: tmp.dir,
      cwd: tmp.dir,
      limit: 10,
    });

    const idxNew = out.indexOf("new-team");
    const idxMid = out.indexOf("mid-personal");
    const idxOld = out.indexOf("old-team");
    expect(idxNew).toBeGreaterThan(-1);
    expect(idxMid).toBeGreaterThan(idxNew);
    expect(idxOld).toBeGreaterThan(idxMid);
  });

  it("honors --limit", () => {
    const teamPath = path.join(tmp.dir, ".teamagent", "knowledge.jsonl");
    writeStore(
      teamPath,
      Array.from({ length: 5 }, (_, i) =>
        makeEntry({
          id: `x-${i}`,
          trigger: `trig-${i}`,
          created_at: `2026-04-14T0${i}:00:00Z`,
        }),
      ),
    );

    const out = executeReview({
      homeDir: tmp.dir,
      cwd: tmp.dir,
      limit: 2,
    });
    expect(out).toContain("展示最近 2");
    // Only 2 triggers rendered
    const hits = ["trig-4", "trig-3", "trig-2", "trig-1", "trig-0"].filter(
      (t) => out.includes(t),
    );
    expect(hits).toHaveLength(2);
  });

  it("honors --scope filter", () => {
    const teamPath = path.join(tmp.dir, ".teamagent", "knowledge.jsonl");
    const personalPath = path.join(
      tmp.dir,
      ".teamagent",
      "personal",
      "knowledge.jsonl",
    );
    writeStore(teamPath, [
      makeEntry({ id: "t1", trigger: "only-in-team" }),
    ]);
    writeStore(personalPath, [
      makeEntry({
        id: "p1",
        scope: { level: "personal" },
        trigger: "only-in-personal",
      }),
    ]);

    const out = executeReview({
      homeDir: tmp.dir,
      cwd: tmp.dir,
      scope: "team",
    });
    expect(out).toContain("only-in-team");
    expect(out).not.toContain("only-in-personal");
  });

  it("renders category/tags/confidence/enforcement", () => {
    const teamPath = path.join(tmp.dir, ".teamagent", "knowledge.jsonl");
    writeStore(teamPath, [
      makeEntry({
        id: "t1",
        category: "K",
        tags: ["cognition"],
        confidence: 0.82,
        enforcement: "warn",
        trigger: "t",
        correct_pattern: "c",
      }),
    ]);
    const out = executeReview({
      homeDir: tmp.dir,
      cwd: tmp.dir,
    });
    expect(out).toMatch(/team\/K\/cognition/);
    expect(out).toContain("conf=0.82");
    expect(out).toContain("warn");
  });
});

describe("parseReviewArgs", () => {
  it("empty args", () => {
    expect(parseReviewArgs([])).toEqual({});
  });

  it("positional number → limit", () => {
    expect(parseReviewArgs(["20"])).toEqual({ limit: 20 });
  });

  it("--limit forms", () => {
    expect(parseReviewArgs(["--limit", "5"])).toEqual({ limit: 5 });
    expect(parseReviewArgs(["--limit=5"])).toEqual({ limit: 5 });
  });

  it("--scope forms", () => {
    expect(parseReviewArgs(["--scope", "team"])).toEqual({ scope: "team" });
    expect(parseReviewArgs(["--scope=personal"])).toEqual({ scope: "personal" });
  });

  it("ignores invalid scope", () => {
    expect(parseReviewArgs(["--scope=foobar"])).toEqual({});
  });
});
