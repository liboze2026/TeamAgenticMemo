import { describe, it, expect } from "vitest";
import { buildExtractionPrompt } from "../prompt.js";
import type { ExtractionInput } from "@teamagent/ports";

const SAMPLE: ExtractionInput = {
  kind: "correction",
  context: "USER: 不用 axios，用 fetch，项目要零依赖\nAI: 好的。",
  weight: 0.95,
};

describe("buildExtractionPrompt", () => {
  it("embeds the context verbatim", () => {
    const p = buildExtractionPrompt(SAMPLE);
    expect(p).toContain("不用 axios，用 fetch");
  });

  it("includes the weight in the context block", () => {
    const p = buildExtractionPrompt(SAMPLE);
    expect(p).toContain("0.95");
  });

  it("names all 8 output fields", () => {
    const p = buildExtractionPrompt(SAMPLE);
    for (const field of [
      "category",
      "tags",
      "type",
      "nature",
      "trigger",
      "wrong_pattern",
      "correct_pattern",
      "reasoning",
    ]) {
      expect(p).toContain(field);
    }
  });

  it("lists all category letters C/E/S/K with Chinese labels", () => {
    const p = buildExtractionPrompt(SAMPLE);
    expect(p).toMatch(/C.*代码层/);
    expect(p).toMatch(/E.*工程层/);
    expect(p).toMatch(/S.*策略层/);
    expect(p).toMatch(/K.*认知层/);
  });

  it("includes both type values and both nature values", () => {
    const p = buildExtractionPrompt(SAMPLE);
    expect(p).toContain("avoidance");
    expect(p).toContain("practice");
    expect(p).toContain("objective");
    expect(p).toContain("subjective");
  });

  it("instructs null output for low-signal cases", () => {
    const p = buildExtractionPrompt(SAMPLE);
    expect(p).toContain("null");
  });

  it("requests JSON fenced block format", () => {
    const p = buildExtractionPrompt(SAMPLE);
    expect(p).toMatch(/```json/);
  });

  it("has at least one few-shot example with a full JSON answer", () => {
    const p = buildExtractionPrompt(SAMPLE);
    // Example should show a full JSON blob with keys
    expect(p).toMatch(/"category"\s*:\s*"[CESK]"/);
    expect(p).toMatch(/"trigger"\s*:\s*"[^"]+"/);
  });

  it("adapts header to success input kind", () => {
    const p = buildExtractionPrompt({ ...SAMPLE, kind: "success" });
    expect(p).toContain("成功模式");
  });

  it("adapts header to rule-text input kind", () => {
    const p = buildExtractionPrompt({ ...SAMPLE, kind: "rule-text" });
    expect(p).toContain("规则文本");
  });

  it.each([
    ["insights", "/insights"],
    ["npm-audit", "npm audit"],
    ["pr-review", "PR review"],
    ["git-hotspot", "热点文件"],
    ["ci-failure", "CI"],
  ] as const)("kind=%s → header mentions '%s'", (kind, fragment) => {
    const p = buildExtractionPrompt({ ...SAMPLE, kind });
    expect(p).toContain(fragment);
  });

  it("trims the context to avoid stray whitespace", () => {
    const p = buildExtractionPrompt({
      ...SAMPLE,
      context: "\n\n   hello world   \n\n",
    });
    expect(p).toContain("hello world");
    // No 4+ consecutive newlines around the context
    expect(p).not.toMatch(/\n\n\n\n/);
  });
});
