import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "../schema.js";
import { WikiStore } from "../wiki-store.js";
import { SqliteWikiRetriever } from "../sqlite-wiki-retriever.js";
import { wikiRetrieverContractSuite } from "@teamagent/ports/contracts";
import type { WikiEntry } from "@teamagent/core";

const FAKE_VEC = new Array(384).fill(0.1) as number[];

function makeWikiEntry(overrides: Partial<WikiEntry> = {}): WikiEntry {
  return {
    id: crypto.randomUUID(),
    title: "axios release notes",
    tldr: "axios 1.x AbortSignal native support",
    keywords: ["axios", "AbortSignal"],
    sourceUrl: "https://example.com/axios",
    sourceType: "npm",
    sourceId: `axios-${crypto.randomUUID()}`,
    publishedAt: new Date("2026-01-15T00:00:00Z"),
    ...overrides,
  };
}

function seedEntryWithVec(db: DatabaseSync, entry: WikiEntry): void {
  const store = new WikiStore(db);
  store.save(entry);
  try {
    db.prepare(
      "INSERT OR REPLACE INTO knowledge_vec(knowledge_id, embedding) VALUES (?, ?)"
    ).run(entry.id, JSON.stringify(FAKE_VEC));
  } catch {
    // sqlite-vec not available in this test env — skip vec insertion
  }
}

// Contract tests (basic behavioral guarantees)
wikiRetrieverContractSuite(() => new SqliteWikiRetriever(openDb(":memory:")));

let db: DatabaseSync;
let retriever: SqliteWikiRetriever;

beforeEach(() => {
  db = openDb(":memory:");
  retriever = new SqliteWikiRetriever(db);
});

describe("SqliteWikiRetriever.query() — seeded data", () => {
  it("excludes user_thumbs_down=1 entries", async () => {
    const entry = makeWikiEntry();
    seedEntryWithVec(db, entry);
    new WikiStore(db).dislike(entry.id);

    const results = await retriever.query({
      embedding: FAKE_VEC,
      minSimilarity: 0.0,
      maxAgeDays: 365,
      maxResults: 5,
      now: new Date("2026-06-01T12:00:00Z"),
      cooldownMinutes: 30,
      sessionWindowMinutes: 60,
      sessionMaxInjections: 15,
    });

    expect(results.find(r => r.knowledgeId === entry.id)).toBeUndefined();
  });

  it("excludes entries older than maxAgeDays", async () => {
    const old = makeWikiEntry({ publishedAt: new Date("2020-01-01T00:00:00Z") });
    seedEntryWithVec(db, old);

    const results = await retriever.query({
      embedding: FAKE_VEC,
      minSimilarity: 0.0,
      maxAgeDays: 30,
      maxResults: 5,
      now: new Date("2026-06-01T12:00:00Z"),
      cooldownMinutes: 30,
      sessionWindowMinutes: 60,
      sessionMaxInjections: 15,
    });

    expect(results.find(r => r.knowledgeId === old.id)).toBeUndefined();
  });

  it("excludes entry within cooldown after recordInjection", async () => {
    const entry = makeWikiEntry();
    seedEntryWithVec(db, entry);
    const now = new Date("2026-06-01T12:00:00Z");

    retriever.recordInjection([entry.id], now);

    const results = await retriever.query({
      embedding: FAKE_VEC,
      minSimilarity: 0.0,
      maxAgeDays: 365,
      maxResults: 5,
      now,
      cooldownMinutes: 30,
      sessionWindowMinutes: 60,
      sessionMaxInjections: 15,
    });

    expect(results.find(r => r.knowledgeId === entry.id)).toBeUndefined();
  });

  it("returns empty when sessionMaxInjections=0", async () => {
    const entry = makeWikiEntry();
    seedEntryWithVec(db, entry);

    const results = await retriever.query({
      embedding: FAKE_VEC,
      minSimilarity: 0.0,
      maxAgeDays: 365,
      maxResults: 5,
      now: new Date("2026-06-01T12:00:00Z"),
      cooldownMinutes: 30,
      sessionWindowMinutes: 60,
      sessionMaxInjections: 0,
    });

    expect(results).toEqual([]);
  });
});

describe("SqliteWikiRetriever.recordInjection()", () => {
  it("updates last_injected_at and increments inline_injection_count", () => {
    const entry = makeWikiEntry();
    seedEntryWithVec(db, entry);
    const now = new Date("2026-06-01T12:00:00Z");

    retriever.recordInjection([entry.id], now);

    const row = db.prepare(
      "SELECT last_injected_at, inline_injection_count FROM wiki_meta WHERE knowledge_id = ?"
    ).get(entry.id) as { last_injected_at: string; inline_injection_count: number };

    expect(row.last_injected_at).toBe(now.toISOString());
    expect(row.inline_injection_count).toBe(1);
  });
});
