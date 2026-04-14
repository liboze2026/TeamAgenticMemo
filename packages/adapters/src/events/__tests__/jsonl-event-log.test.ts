import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { JsonlEventLog } from "../jsonl-event-log.js";
import type { PersistedEvent } from "@teamagent/types";

function tmpFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evtlog-"));
  return path.join(dir, "events.jsonl");
}

function makeEvt(overrides: Partial<PersistedEvent> = {}): PersistedEvent {
  return {
    id: "evt-1",
    kind: "hook-pre.matched",
    timestamp: "2026-04-14T00:00:00Z",
    schema_version: 1,
    ...overrides,
  };
}

describe("JsonlEventLog", () => {
  let p: string;

  beforeEach(() => {
    p = tmpFile();
  });

  afterEach(() => {
    fs.rmSync(path.dirname(p), { recursive: true, force: true });
  });

  it("creates parent dir + file on first append", () => {
    const log = new JsonlEventLog(p);
    log.append(makeEvt());
    expect(fs.existsSync(p)).toBe(true);
  });

  it("appends one line per event", () => {
    const log = new JsonlEventLog(p);
    log.append(makeEvt({ id: "a" }));
    log.append(makeEvt({ id: "b" }));
    log.append(makeEvt({ id: "c" }));
    const lines = fs.readFileSync(p, "utf-8").split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
  });

  it("each line is valid JSON parseable to PersistedEvent", () => {
    const log = new JsonlEventLog(p);
    const evt = makeEvt({
      id: "x",
      intervention_id: "iv-1",
      knowledge_id: "rule-1",
      tool: { name: "Bash", input: { command: "ls" } },
    });
    log.append(evt);
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8").trim()) as PersistedEvent;
    expect(parsed.id).toBe("x");
    expect(parsed.intervention_id).toBe("iv-1");
    expect(parsed.tool?.name).toBe("Bash");
  });

  it("appends across multiple instances (no overwrite)", () => {
    new JsonlEventLog(p).append(makeEvt({ id: "first" }));
    new JsonlEventLog(p).append(makeEvt({ id: "second" }));
    const lines = fs.readFileSync(p, "utf-8").split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it("readAll returns events in order", () => {
    const log = new JsonlEventLog(p);
    log.append(makeEvt({ id: "1" }));
    log.append(makeEvt({ id: "2" }));
    log.append(makeEvt({ id: "3" }));
    const all = log.readAll();
    expect(all.map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("readAll skips malformed lines", () => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
      p,
      `${JSON.stringify(makeEvt({ id: "ok-1" }))}\nNOT JSON\n${JSON.stringify(makeEvt({ id: "ok-2" }))}\n`,
    );
    const all = new JsonlEventLog(p).readAll();
    expect(all.map((e) => e.id)).toEqual(["ok-1", "ok-2"]);
  });

  it("readAll on missing file returns []", () => {
    expect(new JsonlEventLog(p).readAll()).toEqual([]);
  });
});
