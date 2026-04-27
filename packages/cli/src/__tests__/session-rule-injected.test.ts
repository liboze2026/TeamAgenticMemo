import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  readSessionInjected,
  appendSessionInjected,
  isFirstPrompt,
} from "../session-rule-injected.js";

const TMP = path.join(os.tmpdir(), `ta-test-session-${Date.now()}`);

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("readSessionInjected", () => {
  it("returns empty set when file does not exist", () => {
    const result = readSessionInjected(TMP, "sess-1");
    expect(result.size).toBe(0);
  });
});

describe("isFirstPrompt", () => {
  it("returns true when no session file exists", () => {
    expect(isFirstPrompt(TMP, "sess-new")).toBe(true);
  });

  it("returns false after appendSessionInjected has been called", () => {
    appendSessionInjected(TMP, "sess-1", ["r1"]);
    expect(isFirstPrompt(TMP, "sess-1")).toBe(false);
  });
});

describe("appendSessionInjected", () => {
  it("creates file and stores ids on first append", () => {
    appendSessionInjected(TMP, "sess-1", ["r1", "r2"]);
    const result = readSessionInjected(TMP, "sess-1");
    expect(result.has("r1")).toBe(true);
    expect(result.has("r2")).toBe(true);
  });

  it("accumulates across multiple appends", () => {
    appendSessionInjected(TMP, "sess-1", ["r1"]);
    appendSessionInjected(TMP, "sess-1", ["r2", "r3"]);
    const result = readSessionInjected(TMP, "sess-1");
    expect(result.size).toBe(3);
    expect(result.has("r1")).toBe(true);
    expect(result.has("r3")).toBe(true);
  });

  it("does not duplicate ids", () => {
    appendSessionInjected(TMP, "sess-1", ["r1"]);
    appendSessionInjected(TMP, "sess-1", ["r1", "r2"]);
    const result = readSessionInjected(TMP, "sess-1");
    expect(result.size).toBe(2);
  });

  it("is a no-op when ids array is empty", () => {
    appendSessionInjected(TMP, "sess-1", []);
    expect(isFirstPrompt(TMP, "sess-1")).toBe(true);
  });
});
