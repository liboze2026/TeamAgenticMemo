import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../storage/sqlite/schema.js";
import { WikiSubscriptionStore } from "../wiki-subscription-store.js";
import type { DatabaseSync } from "node:sqlite";

let db: DatabaseSync;
let store: WikiSubscriptionStore;

beforeEach(() => {
  db = openDb(":memory:");
  store = new WikiSubscriptionStore(db);
});

describe("WikiSubscriptionStore.isEmpty()", () => {
  it("returns true on empty table", () => {
    expect(store.isEmpty()).toBe(true);
  });

  it("returns false after adding a subscription", () => {
    store.add("arxiv", { query: "LLM" });
    expect(store.isEmpty()).toBe(false);
  });
});

describe("WikiSubscriptionStore.saveAll()", () => {
  it("creates all provided subscriptions", () => {
    store.saveAll([
      { sourceType: "arxiv", config: { query: "LLM" }, autoAdded: true },
      { sourceType: "github", config: { owner: "anthropics" }, autoAdded: false },
    ]);

    const list = store.list();
    expect(list.length).toBe(2);
    expect(list.map((s) => s.sourceType)).toContain("arxiv");
    expect(list.map((s) => s.sourceType)).toContain("github");
  });

  it("is idempotent — calling saveAll twice does not create duplicates", () => {
    const configs = [
      { sourceType: "arxiv", config: { query: "LLM" }, autoAdded: true },
    ];
    store.saveAll(configs);
    store.saveAll(configs);

    const list = store.list();
    expect(list.length).toBe(1);
  });

  it("adds new entries while skipping existing ones on second call", () => {
    store.saveAll([
      { sourceType: "arxiv", config: { query: "LLM" }, autoAdded: true },
    ]);
    store.saveAll([
      { sourceType: "arxiv", config: { query: "LLM" }, autoAdded: true },  // duplicate
      { sourceType: "github", config: { owner: "anthropics" }, autoAdded: false }, // new
    ]);

    const list = store.list();
    expect(list.length).toBe(2);
  });
});

describe("WikiSubscriptionStore.list()", () => {
  it("returns all subscriptions with correct fields", () => {
    store.add("arxiv", { query: "transformers" }, true);

    const list = store.list();
    expect(list.length).toBe(1);

    const sub = list[0]!;
    expect(sub.sourceType).toBe("arxiv");
    expect(sub.config).toEqual({ query: "transformers" });
    expect(sub.autoAdded).toBe(true);
    expect(sub.enabled).toBe(true);
    expect(sub.id).toBeTruthy();
    expect(sub.createdAt).toBeTruthy();
  });
});

describe("WikiSubscriptionStore.getEnabledConfigs()", () => {
  it("returns only enabled subscriptions", () => {
    store.add("arxiv", { query: "LLM" });
    store.add("github", { owner: "openai" });

    // Disable one directly in DB
    const list = store.list();
    db.prepare("UPDATE wiki_subscriptions SET enabled = 0 WHERE id = ?").run(list[0]!.id);

    const enabled = store.getEnabledConfigs();
    expect(enabled.length).toBe(1);
  });

  it("returns sourceType and config for each enabled entry", () => {
    store.add("arxiv", { query: "agents" });

    const enabled = store.getEnabledConfigs();
    expect(enabled[0]!.sourceType).toBe("arxiv");
    expect(enabled[0]!.config).toEqual({ query: "agents" });
  });
});

describe("WikiSubscriptionStore.remove()", () => {
  it("removes by id and returns true", () => {
    store.add("arxiv", { query: "LLM" });
    const list = store.list();
    const id = list[0]!.id;

    const result = store.remove(id);
    expect(result).toBe(true);
    expect(store.list().length).toBe(0);
  });

  it("returns false for nonexistent id", () => {
    const result = store.remove("nonexistent-uuid");
    expect(result).toBe(false);
  });
});
