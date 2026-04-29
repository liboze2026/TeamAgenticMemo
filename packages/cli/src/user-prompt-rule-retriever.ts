import fs from "node:fs";
import path from "node:path";
import type { KnowledgeEntry } from "@teamagent/types";
import { detectStack, semanticMatch, rerankByConfidence } from "@teamagent/core";
import {
  XenovaRuleEmbedder,
  SqliteSemanticRetriever,
  openDb,
} from "@teamagent/adapters";
import type { SemanticMatch } from "@teamagent/core";

const TOP_K = 3;
const MIN_SCORE = 0.35;

export interface RetrieveRulesArgs {
  userMessage: string;
  cwd: string;
  projectDbPath: string;
  globalDbPath: string;
  sessionSeenIds: Set<string>;
  isFirstPrompt: boolean;
  embedder?: XenovaRuleEmbedder;
}

export interface RuleRetrievalResult {
  tier1Rules: KnowledgeEntry[];
  tier2Rules: KnowledgeEntry[];
  injectionText: string;
  allInjectedIds: string[];
}

export function buildTechStackText(cwd: string): string {
  const presence = {
    exists: (rel: string) => {
      try { return fs.existsSync(path.join(cwd, rel)); } catch { return false; }
    },
    read: (rel: string): string | undefined => {
      try { return fs.readFileSync(path.join(cwd, rel), "utf-8"); } catch { return undefined; }
    },
  };
  try {
    const stack = detectStack(presence);
    const parts = [
      ...stack.languages,
      ...stack.frameworks,
      ...stack.packageManagers,
      ...stack.testRunners,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "software project";
  } catch {
    return "software project";
  }
}

export function buildTerminalSummary(tier1: KnowledgeEntry[], tier2: KnowledgeEntry[]): string {
  const all = [...tier1, ...tier2];
  if (all.length === 0) return "";
  const summary = all
    .map((r) => `${r.trigger.slice(0, 28)} -> ${r.correct_pattern.slice(0, 34)}`)
    .join("; ");
  const content = `找到 ${all.length} 条相关经验: ${summary}`;
  const maxContentLength = 150;
  const clipped =
    content.length > maxContentLength
      ? `${content.slice(0, maxContentLength - 3)}...`
      : content;
  return [
    "========|| TeamAgent ||========",
    `|| ${clipped} ||`,
    "========||===========||========",
  ].join("\n");
}

export function formatRuleInjection(rules: KnowledgeEntry[], tier: "T1" | "T2"): string {
  if (rules.length === 0) return "";
  const lines = [`◈ TeamAgent 相关经验（语义检索 ${tier}）`];
  for (const r of rules) {
    const conf = r.confidence.toFixed(2);
    lines.push(`- [${r.trigger.slice(0, 50)}] → ${r.correct_pattern.slice(0, 80)} (conf ${conf})`);
  }
  return lines.join("\n");
}

async function queryRules(
  text: string,
  embedder: XenovaRuleEmbedder,
  projectDbPath: string,
  globalDbPath: string,
  excludeIds: Set<string>,
): Promise<KnowledgeEntry[]> {
  // project DB 存放用户积累的 personal-scope 规则；global DB 存放跨项目 global-scope 规则。
  // 必须按 DB 来源传正确的 scope，否则 scope_level 过滤会把所有 personal 规则过滤掉（零命中）。
  const dbsWithScope: Array<{ path: string; scope: "personal" | "global" }> = [
    { path: projectDbPath, scope: "personal" },
    { path: globalDbPath,  scope: "global"   },
  ];

  const dbs: ReturnType<typeof openDb>[] = [];
  const hits: SemanticMatch[] = [];

  try {
    for (const { path: dbPath, scope } of dbsWithScope) {
      if (!fs.existsSync(dbPath)) continue;
      const db = openDb(dbPath);
      dbs.push(db);
      const retriever = new SqliteSemanticRetriever(db);
      const matches = await semanticMatch({
        contextText: text,
        actionText: text,
        embedder,
        retriever,
        scope: { level: scope },
        topK: TOP_K * 3,
      });
      hits.push(...matches);
    }
  } finally {
    for (const db of dbs) { try { db.close(); } catch { /* ok */ } }
  }

  const reranked = rerankByConfidence(hits);
  const seen = new Set<string>();
  const result: KnowledgeEntry[] = [];
  for (const m of reranked) {
    if (m.score < MIN_SCORE) continue;
    if (excludeIds.has(m.rule.id)) continue;
    if (seen.has(m.rule.id)) continue;
    seen.add(m.rule.id);
    result.push(m.rule);
    if (result.length >= TOP_K) break;
  }
  return result;
}

export async function retrieveRulesForPrompt(
  args: RetrieveRulesArgs,
): Promise<RuleRetrievalResult> {
  const embedder = args.embedder ?? new XenovaRuleEmbedder();
  const allSeen = new Set(args.sessionSeenIds);

  let tier1Rules: KnowledgeEntry[] = [];
  if (args.isFirstPrompt) {
    const techText = buildTechStackText(args.cwd);
    tier1Rules = await queryRules(techText, embedder, args.projectDbPath, args.globalDbPath, allSeen);
    for (const r of tier1Rules) allSeen.add(r.id);
  }

  const tier2Rules = await queryRules(
    args.userMessage,
    embedder,
    args.projectDbPath,
    args.globalDbPath,
    allSeen,
  );

  const blocks: string[] = [];
  const t1text = formatRuleInjection(tier1Rules, "T1");
  if (t1text) blocks.push(t1text);
  const t2text = formatRuleInjection(tier2Rules, "T2");
  if (t2text) blocks.push(t2text);

  return {
    tier1Rules,
    tier2Rules,
    injectionText: blocks.join("\n\n"),
    allInjectedIds: [
      ...tier1Rules.map((r) => r.id),
      ...tier2Rules.map((r) => r.id),
    ],
  };
}
