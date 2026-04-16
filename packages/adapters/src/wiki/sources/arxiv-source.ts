import Parser from "rss-parser";
import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";
import { WikiFetchError } from "@teamagent/ports";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export class ArxivSource implements WikiSourcePort {
  readonly sourceType = "arxiv" as const;
  private parser = new Parser({ customFields: { item: ["summary"] } });

  async fetch(config: WikiSourceConfig, since: Date): Promise<RawWikiItem[]> {
    const category = config["category"] as string;
    const url = `https://export.arxiv.org/rss/${category}`;

    let feed: Awaited<ReturnType<typeof this.parser.parseURL>>;
    try {
      feed = await this.parser.parseURL(url);
    } catch (err) {
      throw new WikiFetchError("arxiv", `Failed to fetch arxiv RSS for ${category}`, err);
    }

    const items: RawWikiItem[] = [];
    for (const item of feed.items) {
      const itemAny = item as unknown as Record<string, unknown>;
      const dateStr = item.isoDate ?? (itemAny["pubDate"] as string | undefined);
      const publishedAt = dateStr ? new Date(dateStr) : new Date();
      if (publishedAt < since) continue;

      const rawContent =
        item.contentSnippet ||
        (itemAny["content:encoded"] as string | undefined) ||
        (itemAny["summary"] as string | undefined) ||
        item.content ||
        "";
      const content = stripHtml(String(rawContent)).replace(/\s+/g, " ").trim();
      if (!content) continue; // contract requires non-empty content

      const link = item.link ?? "";
      const sourceId = link.split("/abs/")[1] || item.guid || link;
      if (!sourceId) continue;

      items.push({
        sourceType: "arxiv",
        sourceUrl: link,
        title: item.title ?? "",
        content,
        publishedAt,
        sourceId,
      });
    }
    return items;
  }
}
