import { describe, it, expect } from "vitest";
import { parseIngestArgs } from "../commands/ingest.js";

describe("parseIngestArgs", () => {
  it("--from-insights requires path", () => {
    const opts = parseIngestArgs(["--from-insights", "./insights.json"]);
    expect(opts.source).toBe("insights");
    expect(opts.filePath).toBe("./insights.json");
  });

  it("--from-audit dispatches to npm-audit", () => {
    const opts = parseIngestArgs(["--from-audit"]);
    expect(opts.source).toBe("npm-audit");
  });

  it("--from-pr takes numeric PR id", () => {
    const opts = parseIngestArgs(["--from-pr", "42"]);
    expect(opts.source).toBe("pr-review");
    expect(opts.prNumber).toBe(42);
  });

  it("--from-git + --since parses days", () => {
    const opts = parseIngestArgs(["--from-git", "--since=30d"]);
    expect(opts.source).toBe("git-hotspot");
    expect(opts.sinceDays).toBe(30);
  });

  it("--from-ci parses --since=45 (no d suffix)", () => {
    const opts = parseIngestArgs(["--from-ci", "--since=45"]);
    expect(opts.source).toBe("ci-failure");
    expect(opts.sinceDays).toBe(45);
  });

  it("--from-candidates reads a md path", () => {
    const opts = parseIngestArgs(["--from-candidates", "./cands.md"]);
    expect(opts.source).toBe("candidates");
    expect(opts.filePath).toBe("./cands.md");
  });

  it("--dry-run flag", () => {
    const opts = parseIngestArgs(["--from-git", "--dry-run"]);
    expect(opts.dryRun).toBe(true);
  });

  it("throws when no source provided", () => {
    expect(() => parseIngestArgs([])).toThrow(/需要源标记/);
  });
});
