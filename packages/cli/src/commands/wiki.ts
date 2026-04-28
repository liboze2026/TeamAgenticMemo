import path from "node:path";

// CLI for wiki commands
export interface WikiCommandOptions {
  // Shared
  dbPath?: string;
  // wiki:pull
  since?: string;        // e.g. "25h", "7d", or ISO date
  dryRun?: boolean;
  // wiki:add (url passed as positional)
  // wiki:list
  limit?: number;
  sourceFilter?: string;
  // wiki:subscribe / wiki:unsubscribe
  repo?: string;
  rss?: string;
  arxiv?: string;
  sourceId?: string;
  // wiki:dislike (knowledgeId passed as positional)
}

function resolveDbPath(opts: WikiCommandOptions): string {
  return opts.dbPath ?? path.join(process.cwd(), ".teamagent", "knowledge.db");
}

function parseSince(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  // Duration format: "25h", "7d", "30m"
  const m = s.match(/^(\d+)(h|d|m)$/);
  if (m) {
    const n = parseInt(m[1]!);
    const unit = m[2]!;
    const ms = unit === "h" ? n * 3_600_000 : unit === "d" ? n * 86_400_000 : n * 60_000;
    return new Date(Date.now() - ms);
  }
  // ISO date
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

// wiki:pull
export async function executeWikiPull(opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { ClaudeCodeLLMClient } = await import("@teamagent/adapters");
  const { loadWikiConfig } = await import("@teamagent/adapters/wiki/config-loader");
  const { WikiPipeline } = await import("@teamagent/adapters/wiki/wiki-pipeline");
  const { XenovaEmbedder } = await import("@teamagent/adapters/wiki/xenova-embedder");

  const db = openDb(resolveDbPath(opts));
  // ClaudeCodeLLMClient defaults to 120s and respects TEAMAGENT_LLM_TIMEOUT_MS.
  const llm = new ClaudeCodeLLMClient();
  const embedder = new XenovaEmbedder();
  const pipeline = new WikiPipeline(db, llm, embedder);
  const cfg = loadWikiConfig(process.cwd());
  const startedAt = new Date();

  const report = await pipeline.run({
    since: parseSince(opts.since),
    dryRun: opts.dryRun,
    manualStackOverride: cfg.manualStack.length > 0 ? cfg.manualStack : undefined,
  });

  if (opts.dryRun) {
    process.stdout.write(`[dry-run] 将拉取 ${report.dryRunItems?.length ?? 0} 条:\n`);
    for (const item of report.dryRunItems ?? []) {
      process.stdout.write(`  [${item.source}] ${item.title} — ${item.url}\n`);
    }
  } else {
    process.stdout.write(
      `wiki:pull 完成 — 新增: ${report.added}, 跳过: ${report.skipped}, 拒绝: ${report.rejected}\n`
    );

    // Append to .teamagent/last-wiki-pull.md so user can see what came in.
    try {
      const newEntries: Array<{ title: string; sourceType: string; tldr: string }> = [];
      if (report.added > 0) {
        const rows = db
          .prepare(
            `SELECT k.trigger AS title, wm.source_type AS source_type, wm.tldr AS tldr
             FROM knowledge k
             JOIN wiki_meta wm ON k.id = wm.knowledge_id
             WHERE k.type = 'wiki' AND k.status = 'active' AND k.created_at >= ?
             ORDER BY k.created_at DESC
             LIMIT 100`,
          )
          .all(startedAt.toISOString()) as Array<{
            title: string;
            source_type: string;
            tldr: string;
          }>;
        for (const r of rows) {
          newEntries.push({
            title: r.title ?? "(untitled)",
            sourceType: r.source_type ?? "unknown",
            tldr: r.tldr ?? "",
          });
        }
      }
      const { appendWikiHarvest } = await import("../wiki-harvest-writer.js");
      appendWikiHarvest(process.cwd(), {
        trigger: "manual",
        forced: false,
        added: report.added,
        archived: 0,
        skipped: false,
        errors: report.errors.map((e) => ({ stage: `pipeline:${e.source}`, error: e.error })),
        newEntries,
      });
    } catch { /* silent — harvest log is best-effort */ }
  }

  if (report.errors.length > 0) {
    process.stderr.write(`错误 (${report.errors.length}):\n`);
    for (const e of report.errors) {
      process.stderr.write(`  ${e.source}: ${e.error}\n`);
    }
  }
}

// wiki:add
export async function executeWikiAdd(url: string, opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { ClaudeCodeLLMClient } = await import("@teamagent/adapters");
  const { WikiPipeline } = await import("@teamagent/adapters/wiki/wiki-pipeline");
  const { XenovaEmbedder } = await import("@teamagent/adapters/wiki/xenova-embedder");

  const db = openDb(resolveDbPath(opts));
  const pipeline = new WikiPipeline(db, new ClaudeCodeLLMClient(), new XenovaEmbedder());

  const report = await pipeline.run({ manualUrl: url });

  process.stdout.write(
    `wiki:add — 新增: ${report.added}, 跳过: ${report.skipped}, 拒绝: ${report.rejected}\n`
  );
}

// wiki:list
export async function executeWikiList(opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiStore } = await import("@teamagent/adapters/storage/sqlite/wiki-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiStore(db);
  const entries = store.list({ limit: opts.limit ?? 20, sourceType: opts.sourceFilter });

  if (entries.length === 0) {
    process.stdout.write("暂无 wiki 条目。先运行 `teamagent wiki:pull` 拉取。\n");
    return;
  }

  for (const e of entries) {
    process.stdout.write(`\n[${e.knowledgeId.slice(0, 8)}] ${e.title}\n`);
    process.stdout.write(`  来源: ${e.sourceType} | ${e.publishedAt.toISOString().slice(0, 10)}\n`);
    process.stdout.write(`  摘要: ${e.tldr}\n`);
    process.stdout.write(`  关键词: ${e.keywords.join(", ")}\n`);
    process.stdout.write(`  链接: ${e.sourceUrl}\n`);
  }
}

// wiki:stats
export async function executeWikiStats(opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiStore } = await import("@teamagent/adapters/storage/sqlite/wiki-store");
  const { WikiSubscriptionStore } = await import("@teamagent/adapters/wiki/wiki-subscription-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiStore(db);
  const subStore = new WikiSubscriptionStore(db);
  const s = store.stats();
  const subs = subStore.list();

  process.stdout.write(`总数: ${s.total} | 订阅: ${subs.length}\n`);
  process.stdout.write(`按来源: ${JSON.stringify(s.bySource)}\n`);
  process.stdout.write(`上次拉取: ${s.lastPull ?? "尚未拉取"}\n`);
}

// wiki:subscriptions
export async function executeWikiSubscriptions(opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiSubscriptionStore } = await import("@teamagent/adapters/wiki/wiki-subscription-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiSubscriptionStore(db);
  const subs = store.list();

  if (subs.length === 0) {
    process.stdout.write("暂无订阅源。运行 `teamagent wiki:pull` 自动订阅默认源。\n");
    return;
  }

  for (const s of subs) {
    const label = s.autoAdded ? "[自动]" : "[手动]";
    process.stdout.write(`${label} ${s.sourceType}: ${JSON.stringify(s.config)}\n`);
  }
}

// wiki:subscribe
export async function executeWikiSubscribe(opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiSubscriptionStore } = await import("@teamagent/adapters/wiki/wiki-subscription-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiSubscriptionStore(db);

  if (opts.repo) {
    store.add("github_release", { repo: opts.repo });
    process.stdout.write(`✓ 已订阅 github_release ${opts.repo}\n`);
  } else if (opts.rss) {
    store.add("rss", { url: opts.rss });
    process.stdout.write(`✓ 已订阅 rss ${opts.rss}\n`);
  } else if (opts.arxiv) {
    store.add("arxiv", { category: opts.arxiv });
    process.stdout.write(`✓ 已订阅 arxiv ${opts.arxiv}\n`);
  } else {
    process.stderr.write("用法: teamagent wiki:subscribe --repo owner/repo | --rss <url> | --arxiv <category>\n");
    process.exit(1);
  }
}

// wiki:unsubscribe
export async function executeWikiUnsubscribe(opts: WikiCommandOptions): Promise<void> {
  if (!opts.sourceId) {
    process.stderr.write("用法: teamagent wiki:unsubscribe --id <id>\n");
    process.exit(1);
  }

  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiSubscriptionStore } = await import("@teamagent/adapters/wiki/wiki-subscription-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiSubscriptionStore(db);
  const found = store.remove(opts.sourceId);
  if (found) {
    process.stdout.write(`✓ 已退订 ${opts.sourceId}\n`);
  } else {
    process.stderr.write(`未找到订阅: ${opts.sourceId}\n`);
    process.exit(1);
  }
}

// wiki:rejected
export async function executeWikiRejected(opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiStore } = await import("@teamagent/adapters/storage/sqlite/wiki-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiStore(db);
  const entries = store.listRejections({ limit: opts.limit ?? 20 });

  if (entries.length === 0) {
    process.stdout.write("暂无被拒绝的条目。\n");
    return;
  }

  for (const e of entries) {
    process.stdout.write(`[${e.id.slice(0, 8)}] ${e.title ?? "(无标题)"} | 原因: ${e.reason}\n`);
  }
}

// wiki:dislike
export async function executeWikiDislike(knowledgeId: string, opts: WikiCommandOptions): Promise<void> {
  const { openDb } = await import("@teamagent/adapters/storage/sqlite/schema");
  const { WikiStore } = await import("@teamagent/adapters/storage/sqlite/wiki-store");

  const db = openDb(resolveDbPath(opts));
  const store = new WikiStore(db);
  const found = store.dislike(knowledgeId);
  if (found) {
    process.stdout.write(`✓ 已标记 ${knowledgeId} 为不喜欢，后续注入会跳过\n`);
  } else {
    process.stderr.write(`未找到条目: ${knowledgeId}\n`);
    process.exit(1);
  }
}

export function parseWikiArgs(args: string[]): { subcommand: string; opts: WikiCommandOptions; extra: string[] } {
  const opts: WikiCommandOptions = {};
  const extra: string[] = [];
  let subcommand = "";

  for (const arg of args) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--since=")) opts.since = arg.slice("--since=".length);
    else if (arg.startsWith("--limit=")) opts.limit = parseInt(arg.slice("--limit=".length));
    else if (arg.startsWith("--source=")) opts.sourceFilter = arg.slice("--source=".length);
    else if (arg.startsWith("--repo=")) opts.repo = arg.slice("--repo=".length);
    else if (arg.startsWith("--rss=")) opts.rss = arg.slice("--rss=".length);
    else if (arg.startsWith("--arxiv=")) opts.arxiv = arg.slice("--arxiv=".length);
    else if (arg.startsWith("--id=")) opts.sourceId = arg.slice("--id=".length);
    else if (!arg.startsWith("--")) {
      if (!subcommand) subcommand = arg;
      else extra.push(arg);
    }
  }

  return { subcommand, opts, extra };
}
