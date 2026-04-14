import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ruleBasedCorrectionDetector } from "../rule-based.js";
import { parseSessionFile } from "../../session-parser/index.js";

const FIXTURE_ROOT = path.resolve(process.cwd(), "fixtures/sessions");

function loadFixture(name: string) {
  return parseSessionFile(
    fs.readFileSync(path.join(FIXTURE_ROOT, name), "utf-8"),
  );
}

describe("ruleBasedCorrectionDetector", () => {
  describe("explicit_denial signal", () => {
    it("catches '不对' in user message", () => {
      const session = loadFixture("correction-denial-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      expect(corrections.length).toBeGreaterThanOrEqual(1);
      const hit = corrections.find((c) => c.signal === "explicit_denial");
      expect(hit).toBeDefined();
      expect(hit!.weight).toBeGreaterThanOrEqual(0.9);
      expect(hit!.turnIndex).toBe(1);
      expect(hit!.correctionText).toContain("不对");
    });

    it("catches '思路不对' variant", () => {
      const session = loadFixture("correction-denial-02.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      const hit = corrections.find((c) => c.signal === "explicit_denial");
      expect(hit).toBeDefined();
    });

    it("catches '错了' variant", () => {
      const session = loadFixture("correction-denial-03.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      const hit = corrections.find((c) => c.signal === "explicit_denial");
      expect(hit).toBeDefined();
    });

    it("captures surrounding context (prev assistant + tool calls)", () => {
      const session = loadFixture("correction-denial-01.jsonl");
      const [hit] = ruleBasedCorrectionDetector.detect(session);
      expect(hit!.previousAssistantText).toContain("axios");
      expect(hit!.previousToolCalls.length).toBeGreaterThan(0);
      expect(hit!.previousToolCalls[0]).toContain("Write");
    });
  });

  describe("multi_failure signal", () => {
    it("detects repeated tool failure before user intervention", () => {
      const session = loadFixture("correction-multi-failure-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      const hit = corrections.find((c) => c.signal === "multi_failure");
      expect(hit).toBeDefined();
      expect(hit!.weight).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("suggestion_override signal", () => {
    it("detects when user pivots to different tool/library", () => {
      const session = loadFixture("correction-override-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      // 用户说 "Zustand" 而 AI 推荐了 "Redux" — override pattern
      const hit = corrections.find(
        (c) => c.signal === "suggestion_override" || c.signal === "explicit_denial",
      );
      expect(hit).toBeDefined();
    });
  });

  describe("code_edit signal", () => {
    it("detects Edit tool with much-larger new_string (user rewrote AI code)", () => {
      const session = loadFixture("correction-code-edit-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      const hit = corrections.find((c) => c.signal === "code_edit");
      expect(hit).toBeDefined();
      expect(hit!.weight).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("no signal (negative cases)", () => {
    it("plain info query → no corrections", () => {
      const session = loadFixture("negative-no-signal-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      expect(corrections).toEqual([]);
    });

    it("success-only fixture → no corrections", () => {
      const session = loadFixture("success-praise-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      expect(corrections).toEqual([]);
    });
  });

  describe("mixed fixture", () => {
    it("correctly identifies the denial in mixed session", () => {
      const session = loadFixture("mixed-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      const hit = corrections.find((c) => c.signal === "explicit_denial");
      expect(hit).toBeDefined();
      expect(hit!.correctionText).toContain("不要");
    });
  });

  describe("ordering", () => {
    it("returns corrections sorted by turn order", () => {
      const session = loadFixture("mixed-01.jsonl");
      const corrections = ruleBasedCorrectionDetector.detect(session);
      for (let i = 1; i < corrections.length; i++) {
        expect(corrections[i]!.turnIndex).toBeGreaterThanOrEqual(
          corrections[i - 1]!.turnIndex,
        );
      }
    });
  });
});
