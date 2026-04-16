import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";
import { WikiFetchError } from "@teamagent/ports";

interface NpmRegistryData {
  name: string;
  time: Record<string, string>;
  versions: Record<string, { description?: string }>;
}

export class NpmSource implements WikiSourcePort {
  readonly sourceType = "npm" as const;

  async fetch(config: WikiSourceConfig, since: Date): Promise<RawWikiItem[]> {
    const pkg = config["package"] as string;
    const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;

    let data: NpmRegistryData;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "teamagent-wiki" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new WikiFetchError(
          "npm",
          `npm registry returned ${res.status} for ${pkg}`,
        );
      }
      data = (await res.json()) as NpmRegistryData;
    } catch (err) {
      if (err instanceof WikiFetchError) throw err;
      throw new WikiFetchError("npm", `Failed to fetch npm package ${pkg}`, err);
    }

    const items: RawWikiItem[] = [];
    for (const [version, timestamp] of Object.entries(data.time)) {
      if (version === "created" || version === "modified") continue;
      const publishedAt = new Date(timestamp);
      if (publishedAt < since) continue;
      const content = data.versions[version]?.description ?? "";
      if (content.length === 0) continue; // contract requires non-empty content
      items.push({
        sourceType: "npm",
        sourceUrl: `https://www.npmjs.com/package/${pkg}/v/${version}`,
        title: `${pkg} v${version}`,
        content,
        publishedAt,
        sourceId: version,
      });
    }
    return items;
  }
}
