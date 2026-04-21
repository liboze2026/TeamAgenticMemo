import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideAction } from "../session-start-logic.js";

describe("decideAction", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "ss-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("无 .teamagent/knowledge.db → skip-no-db", () => {
    const action = decideAction(cwd, new Date(), 24);
    expect(action).toBe("skip-no-db");
  });

  it("有 db 无 marker → spawn（首次）", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "knowledge.db"), "");
    expect(decideAction(cwd, new Date(), 24)).toBe("spawn");
  });

  it("marker 在 24h 内 → skip-debounced", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "knowledge.db"), "");
    writeFileSync(
      join(cwd, ".teamagent", "wiki-last-pull.json"),
      JSON.stringify({ attemptedAt: new Date().toISOString(), added: 0, archived: 0 }),
    );
    expect(decideAction(cwd, new Date(), 24)).toBe("skip-debounced");
  });

  it("marker 在 24h 外 → spawn", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "knowledge.db"), "");
    const stale = new Date(Date.now() - 25 * 3_600_000);
    writeFileSync(
      join(cwd, ".teamagent", "wiki-last-pull.json"),
      JSON.stringify({ attemptedAt: stale.toISOString(), added: 0, archived: 0 }),
    );
    expect(decideAction(cwd, new Date(), 24)).toBe("spawn");
  });

  it("autoRefresh.enabled=false → skip-disabled", () => {
    mkdirSync(join(cwd, ".teamagent"), { recursive: true });
    writeFileSync(join(cwd, ".teamagent", "knowledge.db"), "");
    writeFileSync(join(cwd, ".teamagent", "config.json"),
      JSON.stringify({ wiki: { autoRefresh: { enabled: false } } }));
    expect(decideAction(cwd, new Date())).toBe("skip-disabled");
  });
});
