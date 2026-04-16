import { describe, it, expect, vi } from "vitest";
import { HaikuJudge, buildJudgePrompt, parseJudgeResponse } from "../haiku-judge.js";
import type { LLMClient, RawWikiItem } from "@teamagent/ports";

function makeItem(overrides: Partial<RawWikiItem> = {}): RawWikiItem {
  return {
    sourceType: "github_release",
    sourceUrl: "https://example.com",
    title: "Test Release",
    content: "Some content",
    publishedAt: new Date("2026-01-01"),
    sourceId: "test-id-1",
    ...overrides,
  };
}

function makeJudgeResponse(items: RawWikiItem[]) {
  return JSON.stringify(
    items.map((item) => ({
      sourceId: item.sourceId,
      valuable: true,
      tldr: "Short summary",
      keywords: ["keyword1"],
      rejectReason: null,
    })),
  );
}

describe("buildJudgePrompt", () => {
  it("includes stack in prompt", () => {
    const items = [makeItem()];
    const stack = ["TypeScript", "React"];
    const prompt = buildJudgePrompt(items, stack);
    expect(prompt).toContain("TypeScript, React");
  });

  it("includes item sourceId, title, and content", () => {
    const item = makeItem({ sourceId: "my-id", title: "My Title", content: "My Content" });
    const prompt = buildJudgePrompt([item], ["Node.js"]);
    expect(prompt).toContain("sourceId: my-id");
    expect(prompt).toContain("title: My Title");
    expect(prompt).toContain("content: My Content");
  });

  it("includes multiple items", () => {
    const items = [
      makeItem({ sourceId: "id-1", title: "Title 1" }),
      makeItem({ sourceId: "id-2", title: "Title 2" }),
    ];
    const prompt = buildJudgePrompt(items, ["Go"]);
    expect(prompt).toContain("sourceId: id-1");
    expect(prompt).toContain("sourceId: id-2");
  });
});

describe("parseJudgeResponse", () => {
  it("correctly maps results by sourceId", () => {
    const items = [
      makeItem({ sourceId: "a", title: "A" }),
      makeItem({ sourceId: "b", title: "B" }),
    ];
    const raw = JSON.stringify([
      { sourceId: "b", valuable: false, tldr: "B summary", keywords: ["x"], rejectReason: "not useful" },
      { sourceId: "a", valuable: true, tldr: "A summary", keywords: ["y"], rejectReason: null },
    ]);
    const result = parseJudgeResponse(raw, items);
    expect(result).toHaveLength(2);
    const [itemA, itemB] = result as [typeof result[0], typeof result[0]];
    expect(itemA.sourceId).toBe("a");
    expect(itemA.valuable).toBe(true);
    expect(itemA.tldr).toBe("A summary");
    expect(itemB.sourceId).toBe("b");
    expect(itemB.valuable).toBe(false);
    expect(itemB.rejectReason).toBe("not useful");
  });

  it("marks item as not valuable when not in response", () => {
    const items = [
      makeItem({ sourceId: "present" }),
      makeItem({ sourceId: "missing" }),
    ];
    const raw = JSON.stringify([
      { sourceId: "present", valuable: true, tldr: "ok", keywords: [], rejectReason: null },
    ]);
    const result = parseJudgeResponse(raw, items);
    const missing = result.find((r) => r.sourceId === "missing")!;
    expect(missing.valuable).toBe(false);
    expect(missing.rejectReason).toBe("not in response");
  });

  it("marks all items as not valuable on JSON parse error", () => {
    const items = [makeItem({ sourceId: "x" }), makeItem({ sourceId: "y" })];
    const result = parseJudgeResponse("not valid json!!!", items);
    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.valuable).toBe(false);
      expect(r.rejectReason).toBe("parse error");
    }
  });

  it("parses JSON wrapped in markdown code block", () => {
    const items = [makeItem({ sourceId: "code-block-id" })];
    const raw = "```json\n" + JSON.stringify([
      { sourceId: "code-block-id", valuable: true, tldr: "great", keywords: ["a"], rejectReason: null },
    ]) + "\n```";
    const result = parseJudgeResponse(raw, items);
    const [first] = result as [typeof result[0]];
    expect(first.valuable).toBe(true);
    expect(first.tldr).toBe("great");
  });

  it("parses JSON wrapped in markdown code block without language tag", () => {
    const items = [makeItem({ sourceId: "plain-fence-id" })];
    const raw = "```\n" + JSON.stringify([
      { sourceId: "plain-fence-id", valuable: false, tldr: "nope", keywords: [], rejectReason: "irrelevant" },
    ]) + "\n```";
    const result = parseJudgeResponse(raw, items);
    const [first] = result as [typeof result[0]];
    expect(first.valuable).toBe(false);
    expect(first.rejectReason).toBe("irrelevant");
  });
});

describe("HaikuJudge", () => {
  it("returns [] for empty input", async () => {
    const llm: LLMClient = { complete: vi.fn() };
    const judge = new HaikuJudge(llm);
    const result = await judge.judge([], ["TypeScript"]);
    expect(result).toEqual([]);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("calls LLM once for items within batchSize", async () => {
    const items = [makeItem({ sourceId: "s1" }), makeItem({ sourceId: "s2" })];
    const llm: LLMClient = {
      complete: vi.fn().mockResolvedValue(makeJudgeResponse(items)),
    };
    const judge = new HaikuJudge(llm, 10);
    const result = await judge.judge(items, ["TypeScript"]);
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it("splits into batches and makes multiple LLM calls", async () => {
    const items = [
      makeItem({ sourceId: "s1" }),
      makeItem({ sourceId: "s2" }),
      makeItem({ sourceId: "s3" }),
      makeItem({ sourceId: "s4" }),
      makeItem({ sourceId: "s5" }),
    ];
    const llm: LLMClient = {
      complete: vi
        .fn()
        .mockImplementation((_prompt: string) => {
          // We don't know exactly which batch items are sent,
          // but we can return all 5 items and parsing will just match what it finds
          return Promise.resolve(makeJudgeResponse(items));
        }),
    };
    const judge = new HaikuJudge(llm, 2); // batchSize=2, 5 items → ceil(5/2)=3 calls
    const result = await judge.judge(items, ["TypeScript"]);
    expect(llm.complete).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(5);
  });

  it("merges original item fields with judge results", async () => {
    const publishedAt = new Date("2026-03-01");
    const item = makeItem({ sourceId: "merge-id", sourceUrl: "https://github.com/test", publishedAt });
    const llm: LLMClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify([
          { sourceId: "merge-id", valuable: true, tldr: "Good stuff", keywords: ["api"], rejectReason: null },
        ]),
      ),
    };
    const judge = new HaikuJudge(llm);
    const judged = await judge.judge([item], ["Node.js"]);
    const judgedItem = judged[0]!;
    expect(judgedItem.sourceUrl).toBe("https://github.com/test");
    expect(judgedItem.publishedAt).toEqual(publishedAt);
    expect(judgedItem.valuable).toBe(true);
    expect(judgedItem.tldr).toBe("Good stuff");
  });
});
