import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MarkdownCompiler } from "../markdown-compiler.js";
import type { KnowledgeEntry } from "@teamagent/types";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "md-compiler-"));
}

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: "test",
    scope: { level: "personal" },
    category: "E",
    tags: ["tech-choice"],
    type: "avoidance",
    nature: "subjective",
    trigger: "date library",
    wrong_pattern: "moment",
    correct_pattern: "dayjs",
    reasoning: "lighter weight",
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

describe("MarkdownCompiler adapter", () => {
  let dir: string;
  let mdPath: string;

  beforeEach(() => {
    dir = tmpDir();
    mdPath = path.join(dir, "CLAUDE.md");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("compile() returns string block (pure, no IO)", () => {
    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    const out = compiler.compile([makeEntry()]);
    expect(out).toContain("TEAMAGENT:START");
    expect(out).toContain("TEAMAGENT:END");
    expect(out).toContain("dayjs");
    // 纯 compile 不应写文件
    expect(fs.existsSync(mdPath)).toBe(false);
  });

  it("writeToFile() creates CLAUDE.md when missing", () => {
    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    const info = compiler.writeToFile([makeEntry()]);
    expect(fs.existsSync(mdPath)).toBe(true);
    expect(info.filePath).toBe(mdPath);
    expect(info.blockLineCount).toBeGreaterThan(0);
  });

  it("writeToFile() preserves content outside TEAMAGENT markers", () => {
    fs.writeFileSync(
      mdPath,
      "# My Project\n\nUser content here.\n\n## Rules\n- always use pnpm\n",
      "utf-8",
    );

    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    compiler.writeToFile([makeEntry()]);

    const content = fs.readFileSync(mdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("User content here.");
    expect(content).toContain("always use pnpm");
    expect(content).toContain("TEAMAGENT:START");
  });

  it("writeToFile() replaces existing TEAMAGENT block, keeps user content", () => {
    fs.writeFileSync(
      mdPath,
      "# Project\n\n<!-- TEAMAGENT:START -->\nold content\n<!-- TEAMAGENT:END -->\n\nAfter.\n",
      "utf-8",
    );

    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    compiler.writeToFile([makeEntry({ correct_pattern: "NEW-PATTERN" })]);

    const content = fs.readFileSync(mdPath, "utf-8");
    expect(content).toContain("NEW-PATTERN");
    expect(content).not.toContain("old content");
    expect(content).toContain("# Project");
    expect(content).toContain("After.");
  });

  it("writeToFile() reports correct block line count", () => {
    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    const info = compiler.writeToFile([makeEntry({ id: "a" }), makeEntry({ id: "b" })]);
    const content = fs.readFileSync(mdPath, "utf-8");
    // 区块应该有 START + header + 2 entries + END = 5 lines
    expect(info.blockLineCount).toBeGreaterThanOrEqual(4);
    expect(content).toContain("TEAMAGENT:START");
  });

  it("writeToFile() reports line offset of block in file", () => {
    fs.writeFileSync(mdPath, "line1\nline2\nline3\n", "utf-8");
    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    const info = compiler.writeToFile([makeEntry()]);
    // Block 应该追加在现有 3 行之后
    expect(info.blockStartLine).toBeGreaterThanOrEqual(3);
  });

  it("empty entries → still writes empty-state block", () => {
    const compiler = new MarkdownCompiler(mdPath, () => "2026-04-14T00:00:00Z");
    compiler.writeToFile([]);
    const content = fs.readFileSync(mdPath, "utf-8");
    expect(content).toContain("暂无经验");
  });
});
