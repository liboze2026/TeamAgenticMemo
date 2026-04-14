import os from "node:os";
import path from "node:path";
import { JsonlKnowledgeStore } from "@teamagent/adapters";
import type { KnowledgeEntry } from "@teamagent/types";

export interface ReviewOptions {
  /** 列出最近 N 条。默认 10。 */
  limit?: number;
  /** 只看指定 scope 的条目 */
  scope?: "personal" | "team" | "global";
  personalPath?: string;
  teamPath?: string;
  globalPath?: string;
  homeDir?: string;
  cwd?: string;
}

interface ReviewRow {
  entry: KnowledgeEntry;
  scope: "personal" | "team" | "global";
}

export function executeReview(opts: ReviewOptions = {}): string {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const paths = {
    personal:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    team: opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    global:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
  };

  const rows: ReviewRow[] = [];
  const levels: Array<"personal" | "team" | "global"> =
    opts.scope ? [opts.scope] : ["personal", "team", "global"];
  for (const level of levels) {
    try {
      const store = new JsonlKnowledgeStore(paths[level]);
      for (const entry of store.getAll()) {
        rows.push({ entry, scope: level });
      }
    } catch {
      // store 不存在或损坏，跳过
    }
  }

  // 按 created_at 倒序
  rows.sort((a, b) =>
    (b.entry.created_at ?? "").localeCompare(a.entry.created_at ?? ""),
  );
  const limit = opts.limit ?? 10;
  const slice = rows.slice(0, limit);

  const lines: string[] = [];
  lines.push("📖 TeamAgent Review — 最近录入的知识条目");
  lines.push("");
  lines.push(`共 ${rows.length} 条，展示最近 ${slice.length}`);
  lines.push("");

  if (slice.length === 0) {
    lines.push("(知识库为空)");
    lines.push("");
    return lines.join("\n");
  }

  for (const { entry, scope } of slice) {
    const date = entry.created_at ? entry.created_at.slice(0, 10) : "????-??-??";
    const tag = entry.tags[0] ?? "untagged";
    lines.push(
      `[${date}] ${scope}/${entry.category}/${tag}  conf=${entry.confidence.toFixed(2)} ${entry.enforcement}`,
    );
    lines.push(`  trigger:  ${entry.trigger}`);
    if (entry.wrong_pattern) {
      lines.push(`  wrong:    ${entry.wrong_pattern}`);
    }
    lines.push(`  correct:  ${entry.correct_pattern}`);
    lines.push(`  reason:   ${entry.reasoning}`);
    lines.push(`  id:       ${entry.id}`);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("  想调整？直接编辑 .teamagent/knowledge.jsonl 或 ~/.teamagent/*");
  lines.push("  改完 teamagent stats 验证，再开新 Claude Code 会话生效。");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n") + "\n";
}

export function parseReviewArgs(argv: string[]): ReviewOptions {
  const opts: ReviewOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--limit" && argv[i + 1]) {
      opts.limit = parseInt(argv[i + 1]!, 10);
      i++;
    } else if (a.startsWith("--limit=")) {
      opts.limit = parseInt(a.slice("--limit=".length), 10);
    } else if (a === "--scope" && argv[i + 1]) {
      const v = argv[i + 1]!;
      if (v === "personal" || v === "team" || v === "global") opts.scope = v;
      i++;
    } else if (a.startsWith("--scope=")) {
      const v = a.slice("--scope=".length);
      if (v === "personal" || v === "team" || v === "global") opts.scope = v;
    } else if (/^\d+$/.test(a)) {
      // positional: teamagent review 20
      opts.limit = parseInt(a, 10);
    }
  }
  return opts;
}
