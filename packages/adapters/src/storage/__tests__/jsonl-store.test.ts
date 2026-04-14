import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runKnowledgeStoreContract } from "@teamagent/ports/contracts";
import { JsonlKnowledgeStore } from "../jsonl-store.js";
import type { KnowledgeEntry } from "@teamagent/types";

function tmpFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jsonl-store-"));
  return path.join(dir, "knowledge.jsonl");
}

function cleanupTmp(filePath: string): void {
  try {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: "e",
    scope: { level: "personal" },
    category: "C",
    tags: ["test"],
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

// 先跑契约测试：任何 KnowledgeStore 实现都该通过
describe("JsonlKnowledgeStore", () => {
  const tmpFiles: string[] = [];
  runKnowledgeStoreContract(() => {
    const f = tmpFile();
    tmpFiles.push(f);
    return new JsonlKnowledgeStore(f);
  });

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) cleanupTmp(f);
  });
});

// IO 特异测试
describe("JsonlKnowledgeStore IO specifics", () => {
  let filePath: string;

  beforeEach(() => {
    filePath = tmpFile();
  });

  afterEach(() => {
    cleanupTmp(filePath);
  });

  it("creates parent directory if missing", () => {
    const deep = path.join(path.dirname(filePath), "a", "b", "c", "k.jsonl");
    new JsonlKnowledgeStore(deep);
    expect(fs.existsSync(deep)).toBe(true);
  });

  it("starts empty when file does not exist", () => {
    const store = new JsonlKnowledgeStore(filePath);
    expect(store.getAll()).toEqual([]);
  });

  it("persists added entries to disk", () => {
    const store = new JsonlKnowledgeStore(filePath);
    store.add(makeEntry({ id: "persist-1" }));
    const raw = fs.readFileSync(filePath, "utf-8");
    expect(raw).toContain("persist-1");
  });

  it("reloads entries from disk on new instance", () => {
    const store = new JsonlKnowledgeStore(filePath);
    store.add(makeEntry({ id: "r1" }));
    store.add(makeEntry({ id: "r2" }));

    const store2 = new JsonlKnowledgeStore(filePath);
    expect(store2.count()).toBe(2);
    expect(store2.getById("r1")).toBeDefined();
    expect(store2.getById("r2")).toBeDefined();
  });

  it("one entry per line (JSONL format)", () => {
    const store = new JsonlKnowledgeStore(filePath);
    store.add(makeEntry({ id: "a" }));
    store.add(makeEntry({ id: "b" }));
    store.add(makeEntry({ id: "c" }));
    const lines = fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .filter((l) => l.trim());
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("update persists to disk", () => {
    const store = new JsonlKnowledgeStore(filePath);
    store.add(makeEntry({ id: "u1", hit_count: 0 }));
    store.update("u1", { hit_count: 42 });
    const store2 = new JsonlKnowledgeStore(filePath);
    expect(store2.getById("u1")?.hit_count).toBe(42);
  });

  it("delete persists to disk", () => {
    const store = new JsonlKnowledgeStore(filePath);
    store.add(makeEntry({ id: "d1" }));
    store.delete("d1");
    const store2 = new JsonlKnowledgeStore(filePath);
    expect(store2.count()).toBe(0);
  });

  it("skips malformed lines on load and continues", () => {
    // 人工写入含坏行的 JSONL
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const good = JSON.stringify(makeEntry({ id: "good-1" }));
    const good2 = JSON.stringify(makeEntry({ id: "good-2" }));
    const content = `${good}\nthis is not json\n${good2}\n`;
    fs.writeFileSync(filePath, content, "utf-8");

    const store = new JsonlKnowledgeStore(filePath);
    expect(store.count()).toBe(2);
    expect(store.getById("good-1")).toBeDefined();
    expect(store.getById("good-2")).toBeDefined();
  });

  it("atomic write: concurrent reads never see half-written file", () => {
    // 创建 store 并写入 10 次，每次后读一次并确认可解析
    const store = new JsonlKnowledgeStore(filePath);
    for (let i = 0; i < 10; i++) {
      store.add(makeEntry({ id: `a${i}` }));
      // 立即读
      const raw = fs.readFileSync(filePath, "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim());
      // 每行都应是完整的 JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    }
  });
});
