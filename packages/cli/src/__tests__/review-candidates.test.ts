import { describe, it, expect } from "vitest";
import { parseReviewCandidatesArgs } from "../commands/review-candidates.js";

describe("parseReviewCandidatesArgs", () => {
  it("defaults to no limit (Infinity = process all)", () => {
    const opts = parseReviewCandidatesArgs([]);
    expect(opts.limit).toBe(Number.POSITIVE_INFINITY);
    // Sanity: slice(0, Infinity) is identity, so executor still processes every
    // pending candidate when --limit is omitted.
    expect([1, 2, 3].slice(0, opts.limit!)).toEqual([1, 2, 3]);
  });

  it("parses --limit=5", () => {
    const opts = parseReviewCandidatesArgs(["--limit=5"]);
    expect(opts.limit).toBe(5);
  });

  it("parses --limit 3 (space)", () => {
    const opts = parseReviewCandidatesArgs(["--limit", "3"]);
    expect(opts.limit).toBe(3);
  });
});
