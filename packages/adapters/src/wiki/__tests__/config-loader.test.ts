import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWikiConfig, DEFAULT_WIKI_CONFIG } from "../config-loader.js";

describe("loadWikiConfig", () => {
  let cwd: string;
  beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), "wiki-conf-")); });
  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("缺 .teamagent/config.json → 默认", () => {
    expect(loadWikiConfig(cwd)).toEqual(DEFAULT_WIKI_CONFIG);
  });

  it("缺 wiki 节 → 默认", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "config.json"), JSON.stringify({ other: "x" }));
    expect(loadWikiConfig(cwd)).toEqual(DEFAULT_WIKI_CONFIG);
  });

  it("部分覆盖 debounceHours", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "config.json"),
      JSON.stringify({ wiki: { autoRefresh: { debounceHours: 6 } } }));
    const c = loadWikiConfig(cwd);
    expect(c.autoRefresh.debounceHours).toBe(6);
    expect(c.autoRefresh.enabled).toBe(true);
    expect(c.sweep).toEqual(DEFAULT_WIKI_CONFIG.sweep);
  });

  it("autoRefresh.enabled=false", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "config.json"),
      JSON.stringify({ wiki: { autoRefresh: { enabled: false } } }));
    expect(loadWikiConfig(cwd).autoRefresh.enabled).toBe(false);
  });

  it("损坏 JSON → 默认，不抛", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "config.json"), "not json");
    expect(loadWikiConfig(cwd)).toEqual(DEFAULT_WIKI_CONFIG);
  });

  it("非法类型字段 → 落回该字段默认", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "config.json"),
      JSON.stringify({ wiki: { autoRefresh: { debounceHours: "bad" } } }));
    expect(loadWikiConfig(cwd).autoRefresh.debounceHours).toBe(24);
  });
});
