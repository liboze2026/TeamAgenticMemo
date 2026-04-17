import { Readability } from "@mozilla/readability";
import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";
import { WikiFetchError } from "@teamagent/ports";

export class ManualSource implements WikiSourcePort {
  readonly sourceType = "manual" as const;

  async fetch(config: WikiSourceConfig, since: Date): Promise<RawWikiItem[]> {
    const url = config["url"] as string;

    let content: string;
    let title: string;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        throw new WikiFetchError("manual", `Failed to fetch ${url}: ${res.status}`);
      }
      const html = await res.text();
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document).parse();
      content = article?.textContent?.trim() ?? "";
      title = article?.title ?? url;
    } catch (err) {
      if (err instanceof WikiFetchError) throw err;
      throw new WikiFetchError("manual", `Failed to fetch ${url}`, err);
    }

    if (!content) return [];

    // Manual source: publishedAt = now; still respect since for contract compliance
    const publishedAt = new Date();
    if (publishedAt < since) return [];

    return [
      {
        sourceType: "manual",
        sourceUrl: url,
        title,
        content,
        publishedAt,
        sourceId: url,
      },
    ];
  }
}
