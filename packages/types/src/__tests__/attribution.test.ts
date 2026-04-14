import { describe, it, expect } from "vitest";
import { parseVisibilityMode, DEFAULT_VISIBILITY } from "../attribution.js";

describe("parseVisibilityMode", () => {
  it("parses valid modes", () => {
    expect(parseVisibilityMode("silent")).toBe("silent");
    expect(parseVisibilityMode("smart")).toBe("smart");
    expect(parseVisibilityMode("verbose")).toBe("verbose");
  });

  it("falls back to default for unknown values", () => {
    expect(parseVisibilityMode("dev")).toBe(DEFAULT_VISIBILITY);
    expect(parseVisibilityMode(undefined)).toBe(DEFAULT_VISIBILITY);
    expect(parseVisibilityMode("")).toBe(DEFAULT_VISIBILITY);
  });

  it("default is smart", () => {
    expect(DEFAULT_VISIBILITY).toBe("smart");
  });
});
