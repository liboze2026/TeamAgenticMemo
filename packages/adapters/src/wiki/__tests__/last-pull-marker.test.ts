import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LastPullMarker } from "../last-pull-marker.js";

describe("LastPullMarker", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiki-marker-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("read()：文件不存在返回 null", () => {
    const m = new LastPullMarker(dir);
    expect(m.read()).toBeNull();
  });

  it("write() 后 read() 能拿到", () => {
    const m = new LastPullMarker(dir);
    const now = new Date("2026-04-21T00:00:00Z");
    m.write({ attemptedAt: now, added: 3, archived: 1 });
    const r = m.read();
    expect(r).not.toBeNull();
    expect(r!.attemptedAt.toISOString()).toBe("2026-04-21T00:00:00.000Z");
    expect(r!.added).toBe(3);
    expect(r!.archived).toBe(1);
  });

  it("shouldSkip()：24h 内返回 true", () => {
    const m = new LastPullMarker(dir);
    m.write({ attemptedAt: new Date("2026-04-20T12:00:00Z"), added: 0, archived: 0 });
    expect(m.shouldSkip(new Date("2026-04-21T00:00:00Z"), 24)).toBe(true);
  });

  it("shouldSkip()：超过 24h 返回 false", () => {
    const m = new LastPullMarker(dir);
    m.write({ attemptedAt: new Date("2026-04-19T00:00:00Z"), added: 0, archived: 0 });
    expect(m.shouldSkip(new Date("2026-04-21T00:00:00Z"), 24)).toBe(false);
  });

  it("shouldSkip()：无标记文件返回 false（首次启动总跑）", () => {
    const m = new LastPullMarker(dir);
    expect(m.shouldSkip(new Date(), 24)).toBe(false);
  });

  it("损坏的 JSON：read 返回 null，不抛", () => {
    const m = new LastPullMarker(dir);
    writeFileSync(join(dir, "wiki-last-pull.json"), "not json");
    expect(m.read()).toBeNull();
  });
});
