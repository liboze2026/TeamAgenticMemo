import { describe, it, expect, vi } from "vitest";
import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";
import { WikiFetchError } from "@teamagent/ports";
import { SourceRegistry } from "../source-registry.js";

function makeStubSource(
  type: RawWikiItem["sourceType"],
  items: RawWikiItem[],
): WikiSourcePort {
  return {
    sourceType: type,
    fetch: vi.fn().mockResolvedValue(items),
  };
}

function makeFailingSource(type: RawWikiItem["sourceType"]): WikiSourcePort {
  return {
    sourceType: type,
    fetch: vi.fn().mockRejectedValue(
      new WikiFetchError(type, "Network failure"),
    ),
  };
}

const SAMPLE_GITHUB_ITEM: RawWikiItem = {
  sourceType: "github_release",
  sourceUrl: "https://github.com/owner/repo/releases/tag/v1.0.0",
  title: "v1.0.0",
  content: "Release notes",
  publishedAt: new Date("2024-01-01"),
  sourceId: "v1.0.0",
};

const SAMPLE_NPM_ITEM: RawWikiItem = {
  sourceType: "npm",
  sourceUrl: "https://www.npmjs.com/package/my-pkg/v/1.0.0",
  title: "my-pkg v1.0.0",
  content: "A useful package",
  publishedAt: new Date("2024-01-01"),
  sourceId: "1.0.0",
};

describe("SourceRegistry", () => {
  describe("fetchAll with multiple configs, all succeed", () => {
    it("collects items from all sources", async () => {
      const registry = new SourceRegistry();
      registry.register(makeStubSource("github_release", [SAMPLE_GITHUB_ITEM]));
      registry.register(makeStubSource("npm", [SAMPLE_NPM_ITEM]));

      const configs: WikiSourceConfig[] = [
        { type: "github_release", repo: "owner/repo" },
        { type: "npm", package: "my-pkg" },
      ];

      const { items, errors } = await registry.fetchAll(configs, new Date(0));
      expect(items).toHaveLength(2);
      expect(errors).toHaveLength(0);
      expect(items.map((i) => i.sourceType)).toContain("github_release");
      expect(items.map((i) => i.sourceType)).toContain("npm");
    });
  });

  describe("single source failure does not affect others", () => {
    it("returns items from successful source when another fails", async () => {
      const registry = new SourceRegistry();
      registry.register(makeStubSource("github_release", [SAMPLE_GITHUB_ITEM]));
      registry.register(makeFailingSource("npm"));

      const configs: WikiSourceConfig[] = [
        { type: "github_release", repo: "owner/repo" },
        { type: "npm", package: "my-pkg" },
      ];

      const { items, errors } = await registry.fetchAll(configs, new Date(0));
      expect(items).toHaveLength(1);
      expect(items[0]?.sourceType).toBe("github_release");
      expect(errors).toHaveLength(1);
      expect(errors[0]?.source).toBe("npm");
    });
  });

  describe("unknown sourceType", () => {
    it("collects error for unknown type without throwing", async () => {
      const registry = new SourceRegistry();
      registry.register(makeStubSource("github_release", [SAMPLE_GITHUB_ITEM]));

      const configs: WikiSourceConfig[] = [
        { type: "github_release", repo: "owner/repo" },
        { type: "npm", package: "unknown" }, // npm not registered
      ];

      const { items, errors } = await registry.fetchAll(configs, new Date(0));
      expect(items).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.error).toMatch(/unknown source type/i);
    });
  });

  describe("empty configs", () => {
    it("returns empty results", async () => {
      const registry = new SourceRegistry();
      const { items, errors } = await registry.fetchAll([], new Date(0));
      expect(items).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
  });

  describe("all sources fail", () => {
    it("returns all errors and no items", async () => {
      const registry = new SourceRegistry();
      registry.register(makeFailingSource("github_release"));
      registry.register(makeFailingSource("npm"));

      const configs: WikiSourceConfig[] = [
        { type: "github_release", repo: "owner/repo" },
        { type: "npm", package: "my-pkg" },
      ];

      const { items, errors } = await registry.fetchAll(configs, new Date(0));
      expect(items).toHaveLength(0);
      expect(errors).toHaveLength(2);
    });
  });
});
