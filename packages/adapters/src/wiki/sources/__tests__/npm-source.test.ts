import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wikiSourceContractSuite } from "@teamagent/ports";
import { NpmSource } from "../npm-source.js";

const SAMPLE_NPM_DATA = {
  name: "my-package",
  time: {
    created: "2023-01-01T00:00:00Z",
    modified: "2024-06-01T00:00:00Z",
    "1.0.0": "2023-03-01T00:00:00Z",
    "1.1.0": "2024-01-01T00:00:00Z",
    "2.0.0": "2024-06-01T00:00:00Z",
  },
  versions: {
    "1.0.0": { description: "Initial release" },
    "1.1.0": { description: "Minor improvements" },
    "2.0.0": { description: "Major rewrite" },
  },
};

function mockFetch(data: unknown = SAMPLE_NPM_DATA) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

describe("NpmSource", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  wikiSourceContractSuite(
    () => {
      vi.stubGlobal("fetch", mockFetch());
      return new NpmSource();
    },
    { type: "npm", package: "my-package" },
  );

  it("filters versions before since date", async () => {
    const source = new NpmSource();
    const since = new Date("2024-01-01T00:00:00Z");
    const items = await source.fetch({ type: "npm", package: "my-package" }, since);
    const versions = items.map((i) => i.sourceId);
    expect(versions).toContain("1.1.0");
    expect(versions).toContain("2.0.0");
    expect(versions).not.toContain("1.0.0");
  });

  it("skips created and modified meta-entries", async () => {
    const source = new NpmSource();
    const items = await source.fetch(
      { type: "npm", package: "my-package" },
      new Date(0),
    );
    const ids = items.map((i) => i.sourceId);
    expect(ids).not.toContain("created");
    expect(ids).not.toContain("modified");
  });

  it("skips versions with no description", async () => {
    const dataWithEmpty = {
      ...SAMPLE_NPM_DATA,
      versions: {
        ...SAMPLE_NPM_DATA.versions,
        "1.0.0": { description: "" },
      },
    };
    vi.stubGlobal("fetch", mockFetch(dataWithEmpty));
    const source = new NpmSource();
    const items = await source.fetch(
      { type: "npm", package: "my-package" },
      new Date(0),
    );
    expect(items.map((i) => i.sourceId)).not.toContain("1.0.0");
  });

  it("throws WikiFetchError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    const source = new NpmSource();
    const { WikiFetchError } = await import("@teamagent/ports");
    await expect(
      source.fetch({ type: "npm", package: "my-package" }, new Date(0)),
    ).rejects.toBeInstanceOf(WikiFetchError);
  });
});
