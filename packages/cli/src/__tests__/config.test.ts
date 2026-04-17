import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  readTeamAgentConfig,
  writeTeamAgentConfig,
  executeConfig,
} from "../commands/config.js";

function mkTmp() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ta-config-"));
  return { cwd, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) };
}

describe("readTeamAgentConfig", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => { tmp = mkTmp(); });
  afterEach(() => { tmp.cleanup(); });

  it("returns default sync when config file missing", () => {
    const cfg = readTeamAgentConfig(tmp.cwd);
    expect(cfg.stop_mode).toBe("sync");
  });

  it("reads stop_mode from file", () => {
    const dir = path.join(tmp.cwd, ".teamagent");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ stop_mode: "async" }));
    const cfg = readTeamAgentConfig(tmp.cwd);
    expect(cfg.stop_mode).toBe("async");
  });
});

describe("writeTeamAgentConfig", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => { tmp = mkTmp(); });
  afterEach(() => { tmp.cleanup(); });

  it("creates .teamagent dir and writes config", () => {
    writeTeamAgentConfig(tmp.cwd, { stop_mode: "async" });
    const raw = fs.readFileSync(path.join(tmp.cwd, ".teamagent", "config.json"), "utf-8");
    expect(JSON.parse(raw).stop_mode).toBe("async");
  });

  it("merges into existing config", () => {
    const dir = path.join(tmp.cwd, ".teamagent");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ stop_mode: "async", other: "preserved" }));
    writeTeamAgentConfig(tmp.cwd, { stop_mode: "sync" });
    const raw = fs.readFileSync(path.join(dir, "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.stop_mode).toBe("sync");
    expect(parsed.other).toBe("preserved");
  });
});

describe("executeConfig", () => {
  let tmp: ReturnType<typeof mkTmp>;
  beforeEach(() => { tmp = mkTmp(); });
  afterEach(() => { tmp.cleanup(); });

  it("stop-mode async writes async to config", () => {
    executeConfig({ subcommand: "stop-mode", value: "async", cwd: tmp.cwd });
    const cfg = readTeamAgentConfig(tmp.cwd);
    expect(cfg.stop_mode).toBe("async");
  });

  it("stop-mode sync writes sync to config", () => {
    executeConfig({ subcommand: "stop-mode", value: "async", cwd: tmp.cwd });
    executeConfig({ subcommand: "stop-mode", value: "sync", cwd: tmp.cwd });
    const cfg = readTeamAgentConfig(tmp.cwd);
    expect(cfg.stop_mode).toBe("sync");
  });

  it("show returns current config as JSON string", () => {
    executeConfig({ subcommand: "stop-mode", value: "async", cwd: tmp.cwd });
    const out = executeConfig({ subcommand: "show", cwd: tmp.cwd });
    expect(out).toContain("async");
  });

  it("throws on invalid stop-mode value", () => {
    expect(() =>
      executeConfig({ subcommand: "stop-mode", value: "invalid", cwd: tmp.cwd })
    ).toThrow();
  });
});
