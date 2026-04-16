import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../schema.js";
import { WikiStore } from "../wiki-store.js";
import type { WikiEntry } from "@teamagent/core";
import type { DatabaseSync } from "node:sqlite";

function makeEntry(overrides: Partial<WikiEntry> = {}): WikiEntry {
  return {
    id: crypto.randomUUID(),
    title: "Test Article",
    tldr: "A short summary of the test article.",
    keywords: ["testing", "wiki"],
    sourceUrl: "https://example.com/article",
    sourceType: "arxiv",
    sourceId: "2401.00001",
    publishedAt: new Date("2024-01-15T10:00:00Z"),
    ...overrides,
  };
}

let db: DatabaseSync;
let store: WikiStore;

beforeEach(() => {
  db = openDb(":memory:");
  store = new WikiStore(db);
});

describe("WikiStore.save()", () => {
  it("inserts knowledge and wiki_meta rows and returns 'saved'", () => {
    const entry = makeEntry();
    const result = store.save(entry);

    expect(result).toBe("saved");

    const kRow = db
      .prepare("SELECT * FROM knowledge WHERE id = ?")
      .get(entry.id) as Record<string, unknown> | undefined;
    expect(kRow).toBeDefined();
    expect(kRow!["type"]).toBe("wiki");
    expect(kRow!["category"]).toBe("W");
    expect(kRow!["nature"]).toBe("wiki");
    expect(kRow!["scope_level"]).toBe("global");
    expect(kRow!["source"]).toBe("wiki_pipeline");
    expect(kRow!["trigger"]).toBe(entry.title);
    expect(kRow!["correct_pattern"]).toBe(entry.tldr);

    const wRow = db
      .prepare("SELECT * FROM wiki_meta WHERE knowledge_id = ?")
      .get(entry.id) as Record<string, unknown> | undefined;
    expect(wRow).toBeDefined();
    expect(wRow!["source_type"]).toBe(entry.sourceType);
    expect(wRow!["source_id"]).toBe(entry.sourceId);
    expect(wRow!["source_url"]).toBe(entry.sourceUrl);
    expect(wRow!["tldr"]).toBe(entry.tldr);
  });

  it("returns 'skipped' and does not double-insert for same source_type+source_id", () => {
    const entry = makeEntry();
    const first = store.save(entry);
    expect(first).toBe("saved");

    // Same sourceType + sourceId but different id
    const duplicate = { ...entry, id: crypto.randomUUID(), title: "Different title" };
    const second = store.save(duplicate);
    expect(second).toBe("skipped");

    // Still only one row in wiki_meta
    const count = db
      .prepare("SELECT COUNT(*) as n FROM wiki_meta WHERE source_type = ? AND source_id = ?")
      .get(entry.sourceType, entry.sourceId) as { n: number };
    expect(count.n).toBe(1);
  });
});

describe("WikiStore.dislike()", () => {
  it("sets user_thumbs_down=1 and returns true", () => {
    const entry = makeEntry();
    store.save(entry);

    const result = store.dislike(entry.id);
    expect(result).toBe(true);

    const row = db
      .prepare("SELECT user_thumbs_down FROM wiki_meta WHERE knowledge_id = ?")
      .get(entry.id) as { user_thumbs_down: number };
    expect(row.user_thumbs_down).toBe(1);
  });

  it("returns false for nonexistent knowledge id", () => {
    const result = store.dislike("nonexistent-id");
    expect(result).toBe(false);
  });
});

describe("WikiStore.list()", () => {
  it("returns entries sorted by publishedAt DESC", () => {
    const entry1 = makeEntry({
      id: crypto.randomUUID(),
      sourceId: "2024.001",
      publishedAt: new Date("2024-01-01T00:00:00Z"),
      title: "Older Article",
    });
    const entry2 = makeEntry({
      id: crypto.randomUUID(),
      sourceId: "2024.002",
      publishedAt: new Date("2024-06-01T00:00:00Z"),
      title: "Newer Article",
    });
    store.save(entry1);
    store.save(entry2);

    const results = store.list({});
    expect(results.length).toBe(2);
    expect(results[0]!.title).toBe("Newer Article");
    expect(results[1]!.title).toBe("Older Article");
  });

  it("filters by sourceType when specified", () => {
    const arxivEntry = makeEntry({
      id: crypto.randomUUID(),
      sourceId: "2024.001",
      sourceType: "arxiv",
      title: "Arxiv Paper",
    });
    const githubEntry = makeEntry({
      id: crypto.randomUUID(),
      sourceId: "gh-001",
      sourceType: "github",
      title: "GitHub Repo",
    });
    store.save(arxivEntry);
    store.save(githubEntry);

    const arxivResults = store.list({ sourceType: "arxiv" });
    expect(arxivResults.length).toBe(1);
    expect(arxivResults[0]!.sourceType).toBe("arxiv");

    const githubResults = store.list({ sourceType: "github" });
    expect(githubResults.length).toBe(1);
    expect(githubResults[0]!.sourceType).toBe("github");
  });

  it("respects limit option", () => {
    for (let i = 0; i < 5; i++) {
      store.save(makeEntry({ id: crypto.randomUUID(), sourceId: `2024.00${i}` }));
    }

    const results = store.list({ limit: 3 });
    expect(results.length).toBe(3);
  });
});

describe("WikiStore.stats()", () => {
  it("returns correct total and bySource counts", () => {
    store.save(makeEntry({ id: crypto.randomUUID(), sourceId: "arx-1", sourceType: "arxiv" }));
    store.save(makeEntry({ id: crypto.randomUUID(), sourceId: "arx-2", sourceType: "arxiv" }));
    store.save(makeEntry({ id: crypto.randomUUID(), sourceId: "gh-1", sourceType: "github" }));

    const s = store.stats();
    expect(s.total).toBe(3);
    expect(s.bySource["arxiv"]).toBe(2);
    expect(s.bySource["github"]).toBe(1);
    expect(s.lastPull).toBeTruthy();
  });

  it("excludes thumbs-down entries from total", () => {
    const entry = makeEntry({ id: crypto.randomUUID(), sourceId: "arx-1" });
    store.save(entry);
    store.dislike(entry.id);

    const s = store.stats();
    expect(s.total).toBe(0);
  });
});

describe("WikiStore.recordRejection() / listRejections()", () => {
  it("round-trips a rejection", () => {
    store.recordRejection({
      sourceType: "arxiv",
      sourceId: "2401.99999",
      title: "Bad Paper",
      reason: "off-topic",
    });

    const rejections = store.listRejections({});
    expect(rejections.length).toBe(1);
    expect(rejections[0]!.sourceType).toBe("arxiv");
    expect(rejections[0]!.title).toBe("Bad Paper");
    expect(rejections[0]!.reason).toBe("off-topic");
    expect(rejections[0]!.rejectedAt).toBeTruthy();
  });

  it("respects limit option", () => {
    for (let i = 0; i < 5; i++) {
      store.recordRejection({ sourceType: "arxiv", reason: `reason-${i}` });
    }
    const results = store.listRejections({ limit: 3 });
    expect(results.length).toBe(3);
  });
});

describe("WikiStore.existsBySource()", () => {
  it("returns false when not yet saved", () => {
    expect(store.existsBySource("arxiv", "2401.12345")).toBe(false);
  });

  it("returns true after saving", () => {
    const entry = makeEntry({ sourceType: "arxiv", sourceId: "2401.12345" });
    store.save(entry);
    expect(store.existsBySource("arxiv", "2401.12345")).toBe(true);
  });
});
