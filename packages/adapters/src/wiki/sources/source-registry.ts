import type { WikiSourcePort, RawWikiItem, WikiSourceConfig } from "@teamagent/ports";

export class SourceRegistry {
  private sources = new Map<string, WikiSourcePort>();

  register(source: WikiSourcePort): void {
    this.sources.set(source.sourceType, source);
  }

  async fetchAll(
    configs: WikiSourceConfig[],
    since: Date,
  ): Promise<{ items: RawWikiItem[]; errors: Array<{ source: string; error: string }> }> {
    const results = await Promise.allSettled(
      configs.map(async (config) => {
        const source = this.sources.get(config.type);
        if (!source) {
          throw new Error(`Unknown source type: ${config.type}`);
        }
        return { items: await source.fetch(config, since), sourceType: config.type };
      }),
    );

    const items: RawWikiItem[] = [];
    const errors: Array<{ source: string; error: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "fulfilled") {
        items.push(...result.value.items);
      } else {
        errors.push({
          source: configs[i]!.type,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return { items, errors };
  }
}
