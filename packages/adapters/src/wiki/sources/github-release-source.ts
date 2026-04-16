import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";
import { WikiFetchError } from "@teamagent/ports";

interface GithubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string;
  prerelease: boolean;
}

export class GithubReleaseSource implements WikiSourcePort {
  readonly sourceType = "github_release" as const;

  async fetch(config: WikiSourceConfig, since: Date): Promise<RawWikiItem[]> {
    const repo = config["repo"] as string;
    const url = `https://api.github.com/repos/${repo}/releases?per_page=20`;

    let releases: GithubRelease[];
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "teamagent-wiki" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new WikiFetchError(
          "github_release",
          `GitHub API returned ${res.status} for ${repo}`,
        );
      }
      releases = (await res.json()) as GithubRelease[];
    } catch (err) {
      if (err instanceof WikiFetchError) throw err;
      throw new WikiFetchError(
        "github_release",
        `Failed to fetch releases for ${repo}`,
        err,
      );
    }

    const items: RawWikiItem[] = [];
    for (const release of releases) {
      if (release.prerelease) continue;
      const publishedAt = new Date(release.published_at);
      if (publishedAt < since) continue;
      const content = release.body ?? "";
      if (content.length === 0) continue; // contract requires non-empty content
      items.push({
        sourceType: "github_release",
        sourceUrl: release.html_url,
        title: release.name || release.tag_name,
        content,
        publishedAt,
        sourceId: release.tag_name,
      });
    }
    return items;
  }
}
