import { describe, it, expect } from "vitest";
import { StdoutRenderer } from "../stdout-renderer.js";
import type { AttributionEvent } from "@teamagent/types";

function makeEvent(overrides: Partial<AttributionEvent> = {}): AttributionEvent {
  return {
    source: "pitfall",
    action: "添加知识条目",
    severity: "highlight",
    timestamp: "2026-04-14T10:00:00Z",
    target: { id: "rule-abc" },
    userFacingValue: 'AI 遇到 "stripe.charges" 时会改用 "paymentIntents"',
    counterfactual: "你会看到 AI 第二次踩同一个坑",
    ...overrides,
  };
}

describe("StdoutRenderer", () => {
  const renderer = new StdoutRenderer();

  describe("silent mode", () => {
    it("empty events → empty string", () => {
      expect(renderer.render([], "silent")).toBe("");
    });

    it("even with highlight events → empty string", () => {
      expect(renderer.render([makeEvent()], "silent")).toBe("");
    });

    it("even with warning → empty string", () => {
      expect(renderer.render([makeEvent({ severity: "warning" })], "silent")).toBe("");
    });
  });

  describe("smart mode (default)", () => {
    it("hides info severity", () => {
      const out = renderer.render([makeEvent({ severity: "info", action: "SHOULD-NOT-APPEAR" })], "smart");
      expect(out).not.toContain("SHOULD-NOT-APPEAR");
    });

    it("shows highlight severity with action line", () => {
      const out = renderer.render([makeEvent({ severity: "highlight" })], "smart");
      expect(out).toContain("添加知识条目");
    });

    it("shows warning severity", () => {
      const out = renderer.render([makeEvent({ severity: "warning", action: "已拦截" })], "smart");
      expect(out).toContain("已拦截");
    });

    it("shows userFacingValue line but NOT counterfactual", () => {
      const out = renderer.render([makeEvent()], "smart");
      expect(out).toContain("paymentIntents");
      expect(out).not.toContain("第二次踩同一个坑");
    });

    it("contains divider lines and header", () => {
      const out = renderer.render([makeEvent()], "smart");
      expect(out).toContain("TeamAgent");
      expect(out).toContain("━");
    });

    it("all-info events in smart mode → empty", () => {
      const out = renderer.render(
        [makeEvent({ severity: "info" }), makeEvent({ severity: "info" })],
        "smart",
      );
      expect(out).toBe("");
    });
  });

  describe("verbose mode", () => {
    it("shows info events", () => {
      const out = renderer.render([makeEvent({ severity: "info", action: "INFO-ACTION" })], "verbose");
      expect(out).toContain("INFO-ACTION");
    });

    it("shows counterfactual", () => {
      const out = renderer.render([makeEvent()], "verbose");
      expect(out).toContain("第二次踩同一个坑");
    });

    it("appends raw JSON events at the end", () => {
      const out = renderer.render([makeEvent()], "verbose");
      expect(out).toContain('"source"');
      expect(out).toContain('"action"');
    });
  });

  describe("snapshot (smart mode)", () => {
    it("matches the canonical attribution block format", () => {
      const out = renderer.render(
        [
          makeEvent({
            action: "添加知识条目 rule-abc123",
            target: { count: 16 },
            userFacingValue: 'AI 遇到 "stripe.charges" 时会改用 "paymentIntents"',
          }),
        ],
        "smart",
      );
      expect(out).toMatchInlineSnapshot(`
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ TeamAgent · 本次操作归因
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ 做了什么: 添加知识条目 rule-abc123
▸ 下次体验: AI 遇到 "stripe.charges" 时会改用 "paymentIntents"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
`);
    });
  });

  describe("change and target rendering (M1 additions)", () => {
    it("renders '知识库变化 X → Y 条' when before/after have knowledgeCount", () => {
      const out = renderer.render(
        [
          makeEvent({
            before: { knowledgeCount: 15 },
            after: { knowledgeCount: 16, categoryTag: "personal/C/api-hallucination" },
          }),
        ],
        "smart",
      );
      expect(out).toContain("知识库变化: 15 → 16 条");
      expect(out).toContain("personal/C/api-hallucination");
    });

    it("renders '传播到 <file> 第 N 行' when target has file + count", () => {
      const out = renderer.render(
        [
          makeEvent({
            target: { file: "CLAUDE.md", count: 32 },
          }),
        ],
        "smart",
      );
      expect(out).toContain("传播到: CLAUDE.md 第 32 行");
    });

    it("renders '传播到 <file>' when count is absent", () => {
      const out = renderer.render(
        [
          makeEvent({
            target: { file: "/path/to/knowledge.jsonl" },
          }),
        ],
        "smart",
      );
      expect(out).toContain("传播到: /path/to/knowledge.jsonl");
    });

    it("full pitfall-added attribution block snapshot", () => {
      const out = renderer.render(
        [
          makeEvent({
            source: "pitfall",
            action: "添加知识条目 pers-abc123 (E/tech-choice)",
            severity: "highlight",
            before: { knowledgeCount: 0 },
            after: { knowledgeCount: 1, categoryTag: "personal/E/tech-choice" },
            target: { file: "CLAUDE.md", count: 12 },
            userFacingValue: "AI 遇到 'npm install moment' 时会改用 dayjs",
          }),
        ],
        "smart",
      );
      expect(out).toMatchInlineSnapshot(`
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ TeamAgent · 本次操作归因
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ 做了什么: 添加知识条目 pers-abc123 (E/tech-choice)
▸ 知识库变化: 0 → 1 条 (personal/E/tech-choice)
▸ 传播到: CLAUDE.md 第 12 行
▸ 下次体验: AI 遇到 'npm install moment' 时会改用 dayjs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
`);
    });
  });
});
