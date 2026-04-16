import { describe, it, expect } from "vitest";
import { parseReviewCandidatesArgs } from "../commands/review-candidates.js";

describe("parseReviewCandidatesArgs", () => {
  it("defaults to no limit", () => {
    const opts = parseReviewCandidatesArgs([]);
    expect(opts.limit).toBeUndefined();
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
