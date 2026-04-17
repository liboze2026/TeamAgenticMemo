import Parser from "rss-parser";
import { Readability } from "@mozilla/readability";
import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";
import { WikiFetchError } from "@teamagent/ports";

async function fetchContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    return article?.textContent?.trim() ?? "";
  } catch {
    return ""; // JS-rendered or failed = empty content ok
  }
}

export class RssSource implements WikiSourcePort {
  readonly sourceType = "rss" as const;
  private parser = new Parser();

  async fetch(config: WikiSourceConfig, since: Date): Promise<RawWikiItem[]> {
    const feedUrl = config["url"] as string;

    let feed: Awaited<ReturnType<typeof this.parser.parseURL>>;
    try {
      feed = await this.parser.parseURL(feedUrl);
    } catch (err) {
      throw new WikiFetchError("rss", `Failed to parse RSS feed ${feedUrl}`, err);
    }

    const items: RawWikiItem[] = [];
    for (const item of feed.items) {
      const dateStr = item.isoDate ?? item.pubDate;
      if (!dateStr) continue;
      const publishedAt = new Date(dateStr);
      if (publishedAt < since) continue;

      const itemUrl = item.link ?? "";
      let content = "";
      if (itemUrl) {
        content = await fetchContent(itemUrl);
      }
      if (!content) {
        content = item.contentSnippet || item.content || "";
      }
      if (!content) continue; // contract requires non-empty content

      const sourceId = item.guid || item.link || item.title || "";
      if (!sourceId) continue;

      items.push({
        sourceType: "rss",
        sourceUrl: itemUrl,
        title: item.title ?? "",
        content,
        publishedAt,
        sourceId,
      });
    }
    return items;
  }
}
