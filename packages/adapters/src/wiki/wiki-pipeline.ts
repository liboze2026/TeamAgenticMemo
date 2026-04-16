import fs from "node:fs";
import path from "node:path";
import type { LLMClient } from "@teamagent/ports";
import type { WikiEmbedderPort } from "@teamagent/ports";
import type { DatabaseSync } from "node:sqlite";
import {
  detectStackPackages,
  mergeStack,
  autoSubscribe,
  filterByStack,
  filterByAge,
  validateWikiItem,
  buildWikiEntry,
  type JudgedWikiItem,
} from "@teamagent/core";
import { HaikuJudge } from "./haiku-judge.js";
import {
  GithubReleaseSource,
  NpmSource,
  RssSource,
  ArxivSource,
  ManualSource,
  SourceRegistry,
} from "./sources/index.js";
import { WikiStore } from "../storage/sqlite/wiki-store.js";
import { WikiSubscriptionStore } from "./wiki-subscription-store.js";
import type { WikiSourceConfig } from "@teamagent/ports";

export interface PipelineOptions {
  since?: Date;            // default: 30 days ago
  dryRun?: boolean;
  manualUrl?: string;      // for wiki:add
  manualStackOverride?: string[];
  cwd?: string;            // for stack detection (default: process.cwd())
}

export interface PipelineReport {
  added: number;
  skipped: number;
  rejected: number;
  errors: Array<{ source: string; error: string }>;
  dryRunItems?: Array<{ title: string; source: string; url: string }>;
}

export class WikiPipeline {
  private registry: SourceRegistry;
  private judge: HaikuJudge;
  private wikiStore: WikiStore;
  private subscriptionStore: WikiSubscriptionStore;

  constructor(
    private db: DatabaseSync,
    private llm: LLMClient,
    private embedder: WikiEmbedderPort,
  ) {
    this.registry = new SourceRegistry();
    this.registry.register(new GithubReleaseSource());
    this.registry.register(new NpmSource());
    this.registry.register(new RssSource());
    this.registry.register(new ArxivSource());
    this.registry.register(new ManualSource());
    this.judge = new HaikuJudge(llm);
    this.wikiStore = new WikiStore(db);
    this.subscriptionStore = new WikiSubscriptionStore(db);
  }

  async run(opts: PipelineOptions = {}): Promise<PipelineReport> {
    const since = opts.since ?? new Date(Date.now() - 30 * 86_400_000);
    const cwd = opts.cwd ?? process.cwd();

    // 1. Detect stack
    const stack = this.detectStack(cwd, opts.manualStackOverride);

    // 2. Auto-subscribe on first run
    if (this.subscriptionStore.isEmpty()) {
      const configs = autoSubscribe(stack);
      if (configs.length > 0) {
        this.subscriptionStore.saveAll(
          configs.map(c => ({ sourceType: c.type as string, config: c as unknown as Record<string, unknown>, autoAdded: true }))
        );
        process.stderr.write(`✓ Auto-subscribed to ${configs.length} sources based on your stack\n`);
      }
    }

    // 3. Get configs to fetch
    let configs: WikiSourceConfig[];
    if (opts.manualUrl) {
      configs = [{ type: "manual" as const, url: opts.manualUrl }];
    } else {
      const enabled = this.subscriptionStore.getEnabledConfigs();
      configs = enabled.map(e => ({ type: e.sourceType as WikiSourceConfig["type"], ...e.config }));
    }

    if (configs.length === 0) {
      return { added: 0, skipped: 0, rejected: 0, errors: [] };
    }

    // 4. Fetch from all sources
    const { items: rawItems, errors } = await this.registry.fetchAll(configs, since);

    // 5. Filter by stack + age (manual URL skips stack filter — user chose it explicitly)
    const filtered = rawItems
      .filter(item => opts.manualUrl ? true : filterByStack(item, stack))
      .filter(item => filterByAge(item, 180));

    if (opts.dryRun) {
      return {
        added: 0,
        skipped: 0,
        rejected: 0,
        errors,
        dryRunItems: filtered.map(i => ({ title: i.title, source: i.sourceType, url: i.sourceUrl })),
      };
    }

    if (filtered.length === 0) {
      return { added: 0, skipped: rawItems.length, rejected: 0, errors };
    }

    // 6. Haiku judgment
    const judged = await this.judge.judge(filtered, stack);

    // 7. Validate + save
    let added = 0;
    let rejected = 0;
    const skipped = rawItems.length - filtered.length;

    const toEmbed: Array<{ id: string; text: string }> = [];

    for (const item of judged) {
      const validation = validateWikiItem(item);
      if (!validation.valid) {
        this.wikiStore.recordRejection({
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          title: item.title,
          reason: validation.reason ?? "validation failed",
        });
        rejected++;
        continue;
      }

      const id = crypto.randomUUID();
      const entry = buildWikiEntry(item, id);
      const result = this.wikiStore.save(entry);

      if (result === "saved") {
        added++;
        toEmbed.push({ id, text: `${item.tldr} ${item.keywords.join(" ")}` });
      }
    }

    // 8. Generate + store embeddings
    if (toEmbed.length > 0) {
      try {
        const vectors = await this.embedder.embed(toEmbed.map(e => e.text));
        for (let i = 0; i < toEmbed.length; i++) {
          try {
            this.db.prepare(
              "INSERT OR REPLACE INTO knowledge_vec(knowledge_id, embedding) VALUES (?, ?)"
            ).run(toEmbed[i]!.id, JSON.stringify(vectors[i]));
          } catch {
            // knowledge_vec may not be available if sqlite-vec failed to load
          }
        }
      } catch {
        // Embedding failure is non-fatal
      }
    }

    return { added, skipped, rejected, errors };
  }

  private detectStack(cwd: string, manualOverride?: string[]): string[] {
    const candidateFiles = [
      "package.json", "requirements.txt", "go.mod", "Cargo.toml"
    ];
    const files: Record<string, string> = {};
    for (const f of candidateFiles) {
      try {
        files[f] = fs.readFileSync(path.join(cwd, f), "utf8");
      } catch {
        // file doesn't exist — skip
      }
    }
    const detected = detectStackPackages(files);
    return mergeStack(detected, manualOverride ?? []);
  }
}
