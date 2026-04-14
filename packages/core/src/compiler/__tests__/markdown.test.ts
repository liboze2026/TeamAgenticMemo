import { describe, it, expect } from "vitest";
import {
  compileMarkdownBlock,
  injectBlockIntoDoc,
  BLOCK_START,
  BLOCK_END,
} from "../markdown.js";
import type { KnowledgeEntry } from "@teamagent/types";

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: "e",
    scope: { level: "personal" },
    category: "C",
    tags: ["syntax-error"],
    type: "avoidance",
    nature: "objective",
    trigger: "trigger",
    wrong_pattern: "moment",
    correct_pattern: "dayjs",
    reasoning: "lighter",
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

describe("compileMarkdownBlock", () => {
  it("wraps output with START/END markers", () => {
    const out = compileMarkdownBlock([makeEntry()], "2026-04-14T00:00:00Z");
    expect(out).toContain(BLOCK_START);
    expect(out).toContain(BLOCK_END);
  });

  it("empty entries → produces empty-state block with markers", () => {
    const out = compileMarkdownBlock([], "2026-04-14T00:00:00Z");
    expect(out).toContain(BLOCK_START);
    expect(out).toContain(BLOCK_END);
    expect(out).toContain("暂无经验");
  });

  it("shows avoidance entries as 'use X instead of Y'", () => {
    const out = compileMarkdownBlock(
      [makeEntry({ wrong_pattern: "moment", correct_pattern: "dayjs" })],
      "2026-04-14T00:00:00Z",
    );
    expect(out).toContain("dayjs");
    expect(out).toContain("moment");
  });

  it("respects 50-line budget", () => {
    const entries = Array.from({ length: 100 }, (_, i) =>
      makeEntry({
        id: `e${i}`,
        confidence: 0.7 + (i % 30) / 100,
        trigger: `trigger-${i}`,
      }),
    );
    const out = compileMarkdownBlock(entries, "2026-04-14T00:00:00Z");
    const lines = out.split("\n");
    expect(lines.length).toBeLessThanOrEqual(50);
  });

  it("skips archived entries", () => {
    const out = compileMarkdownBlock(
      [
        makeEntry({ id: "active", correct_pattern: "KEEP" }),
        makeEntry({ id: "dropped", correct_pattern: "DROPPED", status: "archived" }),
      ],
      "2026-04-14T00:00:00Z",
    );
    expect(out).toContain("KEEP");
    expect(out).not.toContain("DROPPED");
  });

  it("block enforcement entries come before suggest", () => {
    const entries = [
      makeEntry({ id: "low", enforcement: "suggest", correct_pattern: "LOW-PRIO", confidence: 0.6 }),
      makeEntry({ id: "high", enforcement: "block", correct_pattern: "HIGH-PRIO", confidence: 0.95 }),
    ];
    const out = compileMarkdownBlock(entries, "2026-04-14T00:00:00Z");
    const lines = out.split("\n");
    const hi = lines.findIndex((l) => l.includes("HIGH-PRIO"));
    const lo = lines.findIndex((l) => l.includes("LOW-PRIO"));
    expect(hi).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThan(lo);
  });
});

describe("injectBlockIntoDoc", () => {
  it("adds block to file without previous markers", () => {
    const existing = "# Project\n\nSome user content.\n";
    const block = `${BLOCK_START}\ntest\n${BLOCK_END}`;
    const out = injectBlockIntoDoc(existing, block);
    expect(out).toContain("# Project");
    expect(out).toContain("Some user content.");
    expect(out).toContain("test");
  });

  it("replaces existing block, preserves user content outside", () => {
    const existing = `# Project\n\n${BLOCK_START}\nold\n${BLOCK_END}\n\nAfter.\n`;
    const block = `${BLOCK_START}\nnew\n${BLOCK_END}`;
    const out = injectBlockIntoDoc(existing, block);
    expect(out).toContain("new");
    expect(out).not.toContain("old");
    expect(out).toContain("After.");
  });

  it("empty input → just the block with final newline", () => {
    const block = `${BLOCK_START}\ntest\n${BLOCK_END}`;
    const out = injectBlockIntoDoc("", block);
    expect(out).toContain(BLOCK_START);
    expect(out.endsWith("\n")).toBe(true);
  });
});
