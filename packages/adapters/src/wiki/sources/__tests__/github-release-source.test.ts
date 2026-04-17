import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wikiSourceContractSuite } from "@teamagent/ports/contracts";
import { GithubReleaseSource } from "../github-release-source.js";

const SAMPLE_RELEASES = [
  {
    tag_name: "v2.0.0",
    name: "Version 2.0.0",
    body: "Major release with breaking changes",
    html_url: "https://github.com/owner/repo/releases/tag/v2.0.0",
    published_at: "2024-06-01T00:00:00Z",
    prerelease: false,
  },
  {
    tag_name: "v1.9.0-beta",
    name: "Version 1.9.0 Beta",
    body: "Beta release",
    html_url: "https://github.com/owner/repo/releases/tag/v1.9.0-beta",
    published_at: "2024-05-01T00:00:00Z",
    prerelease: true,
  },
  {
    tag_name: "v1.8.0",
    name: "Version 1.8.0",
    body: "Stable release with bug fixes",
    html_url: "https://github.com/owner/repo/releases/tag/v1.8.0",
    published_at: "2024-01-01T00:00:00Z",
    prerelease: false,
  },
  {
    tag_name: "v1.7.0",
    name: null,
    body: null,
    html_url: "https://github.com/owner/repo/releases/tag/v1.7.0",
    published_at: "2023-01-01T00:00:00Z",
    prerelease: false,
  },
];

function mockFetch(releases: unknown[] = SAMPLE_RELEASES) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => releases,
  });
}

describe("GithubReleaseSource", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  wikiSourceContractSuite(
    () => {
      vi.stubGlobal("fetch", mockFetch());
      return new GithubReleaseSource();
    },
    { type: "github_release", repo: "owner/repo" },
  );

  it("filters out prerelease releases", async () => {
    const source = new GithubReleaseSource();
    const items = await source.fetch(
      { type: "github_release", repo: "owner/repo" },
      new Date(0),
    );
    const tags = items.map((i) => i.sourceId);
    expect(tags).not.toContain("v1.9.0-beta");
  });

  it("filters releases before since date", async () => {
    const source = new GithubReleaseSource();
    const since = new Date("2024-05-01T00:00:00Z");
    const items = await source.fetch(
      { type: "github_release", repo: "owner/repo" },
      since,
    );
    for (const item of items) {
      expect(item.publishedAt.getTime()).toBeGreaterThanOrEqual(since.getTime());
    }
    // v2.0.0 (June 2024) should be included
    expect(items.map((i) => i.sourceId)).toContain("v2.0.0");
    // v1.8.0 (Jan 2024) should be excluded
    expect(items.map((i) => i.sourceId)).not.toContain("v1.8.0");
  });

  it("filters releases with empty body/content", async () => {
    const source = new GithubReleaseSource();
    const items = await source.fetch(
      { type: "github_release", repo: "owner/repo" },
      new Date(0),
    );
    // v1.7.0 has null body — should be filtered
    expect(items.map((i) => i.sourceId)).not.toContain("v1.7.0");
  });

  it("throws WikiFetchError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    const source = new GithubReleaseSource();
    const { WikiFetchError } = await import("@teamagent/ports");
    await expect(
      source.fetch({ type: "github_release", repo: "owner/repo" }, new Date(0)),
    ).rejects.toBeInstanceOf(WikiFetchError);
  });
});
