export interface RawWikiItem {
  sourceType: "github_release" | "npm" | "rss" | "arxiv" | "manual";
  sourceUrl: string;
  title: string;
  content: string;
  publishedAt: Date;
  sourceId: string; // unique key per source type for dedup
}

export interface WikiSourceConfig {
  type: RawWikiItem["sourceType"];
  // github_release: { repo: "owner/repo" }
  // npm: { package: "pkg-name" }
  // rss: { url: "https://..." }
  // arxiv: { category: "cs.AI" }
  [key: string]: unknown;
}

export class WikiFetchError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WikiFetchError";
  }
}

export interface WikiSourcePort {
  readonly sourceType: RawWikiItem["sourceType"];
  fetch(config: WikiSourceConfig, since: Date): Promise<RawWikiItem[]>;
}
