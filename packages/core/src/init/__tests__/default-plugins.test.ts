import { describe, it, expect } from "vitest";
import {
  DEFAULT_MARKETPLACES,
  DEFAULT_PLUGINS,
  parsePluginSpec,
  formatPluginSpec,
  type PluginSpec,
} from "../default-plugins.js";

describe("DEFAULT_MARKETPLACES", () => {
  it("contains the 2 team-standard marketplaces", () => {
    const names = DEFAULT_MARKETPLACES.map((m) => m.name);
    expect(names).toEqual([
      "claude-plugins-official",
      "knowledge-work-plugins",
    ]);
  });

  it("maps each marketplace to an owner/repo github spec", () => {
    const byName = Object.fromEntries(
      DEFAULT_MARKETPLACES.map((m) => [m.name, m.repo]),
    );
    expect(byName["claude-plugins-official"]).toBe("anthropics/claude-plugins-official");
    expect(byName["knowledge-work-plugins"]).toBe("anthropics/knowledge-work-plugins");
  });
});

describe("DEFAULT_PLUGINS", () => {
  it("contains the 3 team-standard plugins", () => {
    const specs = DEFAULT_PLUGINS.map((p) => `${p.plugin}@${p.marketplace}`);
    expect(specs).toEqual([
      "superpowers@claude-plugins-official",
      "playground@claude-plugins-official",
      "sales@knowledge-work-plugins",
    ]);
  });

  it("every plugin references a known marketplace", () => {
    const mpNames = new Set(DEFAULT_MARKETPLACES.map((m) => m.name));
    for (const p of DEFAULT_PLUGINS) {
      expect(mpNames.has(p.marketplace)).toBe(true);
    }
  });
});

describe("parsePluginSpec", () => {
  it('parses "plugin@marketplace"', () => {
    expect(parsePluginSpec("superpowers@claude-plugins-official")).toEqual({
      plugin: "superpowers",
      marketplace: "claude-plugins-official",
    } satisfies PluginSpec);
  });

  it("throws on missing @", () => {
    expect(() => parsePluginSpec("superpowers")).toThrow(/invalid plugin spec/);
  });

  it("throws on empty plugin or marketplace", () => {
    expect(() => parsePluginSpec("@foo")).toThrow(/invalid plugin spec/);
    expect(() => parsePluginSpec("foo@")).toThrow(/invalid plugin spec/);
    expect(() => parsePluginSpec("@")).toThrow(/invalid plugin spec/);
  });

  it("trims surrounding whitespace", () => {
    expect(parsePluginSpec("  superpowers@claude-plugins-official  ")).toEqual({
      plugin: "superpowers",
      marketplace: "claude-plugins-official",
    });
  });
});

describe("formatPluginSpec", () => {
  it('produces "plugin@marketplace"', () => {
    expect(formatPluginSpec({ plugin: "sales", marketplace: "knowledge-work-plugins" })).toBe(
      "sales@knowledge-work-plugins",
    );
  });

  it("roundtrips with parsePluginSpec", () => {
    for (const p of DEFAULT_PLUGINS) {
      expect(parsePluginSpec(formatPluginSpec(p))).toEqual(p);
    }
  });
});
