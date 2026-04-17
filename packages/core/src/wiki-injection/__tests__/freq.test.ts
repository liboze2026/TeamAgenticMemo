import { describe, it, expect } from "vitest";
import { shouldInject } from "../freq.js";
import type { FreqState, FreqConfig } from "../freq.js";

const BASE_CONFIG: FreqConfig = {
  cooldownMinutes: 30,
  sessionWindowMinutes: 60,
  sessionMaxInjections: 15,
  now: new Date("2026-04-17T12:00:00Z"),
};

describe("shouldInject", () => {
  it("returns true when never injected", () => {
    const state: FreqState = { lastInjectedAt: null, recentSessionCount: 0 };
    expect(shouldInject(state, BASE_CONFIG)).toBe(true);
  });

  it("returns false when session limit reached", () => {
    const state: FreqState = { lastInjectedAt: null, recentSessionCount: 15 };
    expect(shouldInject(state, BASE_CONFIG)).toBe(false);
  });

  it("returns false when last injection within cooldown", () => {
    const state: FreqState = {
      lastInjectedAt: new Date("2026-04-17T11:45:00Z"), // 15 min ago, cooldown=30
      recentSessionCount: 0,
    };
    expect(shouldInject(state, BASE_CONFIG)).toBe(false);
  });

  it("returns true when last injection beyond cooldown", () => {
    const state: FreqState = {
      lastInjectedAt: new Date("2026-04-17T11:00:00Z"), // 60 min ago, cooldown=30
      recentSessionCount: 0,
    };
    expect(shouldInject(state, BASE_CONFIG)).toBe(true);
  });

  it("session limit check takes priority over cooldown", () => {
    const state: FreqState = {
      lastInjectedAt: null,
      recentSessionCount: 15,
    };
    expect(shouldInject(state, BASE_CONFIG)).toBe(false);
  });
});
