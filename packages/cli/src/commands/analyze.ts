import os from "node:os";
import path from "node:path";
import fsSync from "node:fs";
import {
  ClaudeSessionSource,
  ClaudeCodeLLMClient,
  JsonlKnowledgeStore,
  MarkdownCompiler,
} from "@teamagent/adapters";
import {
  ruleBasedCorrectionDetector,
  ruleBasedSuccessDetector,
  parseSessionFile,
  llmBasedKnowledgeExtractor,
  runExtractPipeline,
} from "@teamagent/core";
import type { LLMClient } from "@teamagent/ports";
import type { KnowledgeEntry, ParsedSession } from "@teamagent/types";

export interface AnalyzeOptions {
  /** 具体 session 文件路径或 sessionId；未指定则分析最近的 session */
  session?: string;
  projectsRoot?: string;
  homeDir?: string;
  /** 详细模式：列出每条信号的完整上下文 */
  verbose?: boolean;
  /** 写入模式：跑 extractor pipeline，把纠正时刻提取成知识条目并落盘 */
  commit?: boolean;
  /** 注入 LLM client（测试用）；缺省用 ClaudeCodeLLMClient */
  llmClient?: LLMClient;
  /** 注入 store 路径（测试用） */
  teamPath?: string;
  personalPath?: string;
  globalPath?: string;
  /** 注入 CLAUDE.md 路径（测试用） */
  claudeMdPath?: string;
  cwd?: string;
  /** id 生成器（测试用） */
  idGen?: () => string;
  /** now (测试用) */
  now?: () => Date;
}

export async function executeAnalyze(opts: AnalyzeOptions = {}): Promise<string> {
  const home = opts.homeDir ?? os.homedir();
  const projectsRoot = opts.projectsRoot ?? path.join(home, ".claude", "projects");

  let session: ParsedSession;
  let sourceDesc: string;

  if (opts.session) {
    // 绝对路径优先
    if (fsSync.existsSync(opts.session)) {
      const raw = fsSync.readFileSync(opts.session, "utf-8");
      session = parseSessionFile(raw);
      sourceDesc = opts.session;
    } else {
      const src = new ClaudeSessionSource(projectsRoot);
      session = await src.loadById(opts.session);
      sourceDesc = opts.session;
    }
  } else {
    const src = new ClaudeSessionSource(projectsRoot);
    const recent = await src.listRecent(1);
    if (recent.length === 0) {
      return [
        "未找到任何会话日志 (~/.claude/projects/ 为空)。",
        "先用 Claude Code 开几次会话再跑 teamagent analyze。",
        "",
      ].join("\n");
    }
    session = await src.loadById(recent[0]!.sessionId);
    sourceDesc = `最近会话 ${recent[0]!.sessionId}`;
  }

  const corrections = ruleBasedCorrectionDetector.detect(session);
  const successes = ruleBasedSuccessDetector.detect(session);
  const dryRun = renderReport(
    session,
    corrections,
    successes,
    sourceDesc,
    opts.verbose ?? false,
    opts.commit === true,
  );

  if (!opts.commit) return dryRun;

  // --commit: 跑 extractor pipeline
  const commitOutput = await runCommit(session, opts);
  return dryRun + "\n" + commitOutput;
}

async function runCommit(
  session: ParsedSession,
  opts: AnalyzeOptions,
): Promise<string> {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const teamPath = opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl");
  const personalPath =
    opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl");
  const globalPath =
    opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl");
  const claudeMdPath = opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md");

  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  const store = new JsonlKnowledgeStore(teamPath);

  const now = opts.now ?? (() => new Date());
  const idGen =
    opts.idGen ??
    (() => {
      const ts = now().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
      const rand = Math.random().toString(36).slice(2, 8);
      return `team-${ts}-${rand}`;
    });

  // recompile 合并三个 scope 的 active entries
  const recompile = (_activeFromTeam: KnowledgeEntry[]): void => {
    const all: KnowledgeEntry[] = [];
    for (const p of [personalPath, teamPath, globalPath]) {
      try {
        const s = new JsonlKnowledgeStore(p);
        all.push(...s.getActive());
      } catch {
        // 文件不存在 / 损坏，跳过
      }
    }
    const compiler = new MarkdownCompiler(claudeMdPath, () => now().toISOString());
    compiler.writeToFile(all);
  };

  const before = store.count();
  const result = await runExtractPipeline(session, {
    detector: ruleBasedCorrectionDetector,
    extractor: llmBasedKnowledgeExtractor,
    callLLM: (prompt) => llm.complete(prompt),
    store,
    recompile,
    scope: { level: "team" },
    source: "accumulated",
    now,
    idGen,
  });

  const after = store.count();
  const lines: string[] = [];
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`  --commit 完成`);
  lines.push(`  识别纠正: ${result.correctionsFound}`);
  lines.push(`  成功提取: ${result.extracted.length}  (跳过 ${result.skipped}, 失败 ${result.failed})`);
  lines.push(`  知识库: ${before} → ${after}`);
  lines.push(`  CLAUDE.md 已重编译: ${claudeMdPath}`);
  if (result.extracted.length > 0) {
    lines.push("");
    lines.push("  新增条目:");
    for (const e of result.extracted) {
      lines.push(
        `    - [${e.category}/${e.tags[0] ?? "untagged"}] ${e.trigger} → ${e.correct_pattern}`,
      );
    }
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n") + "\n";
}

function renderReport(
  session: ParsedSession,
  corrections: ReturnType<typeof ruleBasedCorrectionDetector.detect>,
  successes: ReturnType<typeof ruleBasedSuccessDetector.detect>,
  sourceDesc: string,
  verbose: boolean,
  committing: boolean,
): string {
  const lines: string[] = [];
  lines.push(
    committing
      ? "📊 TeamAgent Session Analyze (--commit 模式)"
      : "📊 TeamAgent Session Analyze (dry-run，不写知识库)",
  );
  lines.push("");
  lines.push(`源: ${sourceDesc}`);
  lines.push(`会话 id: ${session.sessionId}`);
  lines.push(`回合数: ${session.turns.length}`);
  lines.push("");
  lines.push(`▸ 识别到纠正时刻: ${corrections.length}`);
  const byCSig: Record<string, number> = {};
  for (const c of corrections) byCSig[c.signal] = (byCSig[c.signal] ?? 0) + 1;
  for (const [s, n] of Object.entries(byCSig)) {
    lines.push(`    - ${s}: ${n}`);
  }
  lines.push("");
  lines.push(`▸ 识别到成功信号: ${successes.length}`);
  const bySSig: Record<string, number> = {};
  for (const s of successes) bySSig[s.signal] = (bySSig[s.signal] ?? 0) + 1;
  for (const [s, n] of Object.entries(bySSig)) {
    lines.push(`    - ${s}: ${n}`);
  }
  lines.push("");

  if (verbose || corrections.length + successes.length <= 10) {
    if (corrections.length > 0) {
      lines.push("--- 纠正时刻明细 ---");
      for (const c of corrections) {
        lines.push(
          `  [turn ${c.turnIndex}] ${c.signal} (w=${c.weight.toFixed(2)})`,
        );
        lines.push(`    用户: ${truncate(c.correctionText, 80)}`);
        if (c.previousAssistantText) {
          lines.push(`    AI上一句: ${truncate(c.previousAssistantText, 80)}`);
        }
      }
      lines.push("");
    }
    if (successes.length > 0) {
      lines.push("--- 成功信号明细 ---");
      for (const s of successes) {
        lines.push(
          `  [turn ${s.turnIndex}] ${s.signal} (w=${s.weight.toFixed(2)})`,
        );
        lines.push(`    AI: ${truncate(s.assistantText, 80)}`);
      }
      lines.push("");
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (committing) {
    lines.push("  dry-run 完成；下面开始 --commit 写入…");
  } else {
    lines.push("  dry-run 完成，未写入知识库。加 --commit 触发提取+落盘。");
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n") + "\n";
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

/** 解析 analyze CLI 参数 */
export function parseAnalyzeArgs(argv: string[]): AnalyzeOptions {
  const opts: AnalyzeOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--verbose" || a === "-v") opts.verbose = true;
    else if (a === "--commit") opts.commit = true;
    else if (a.startsWith("--session=")) opts.session = a.slice("--session=".length);
    else if (a === "--session" && argv[i + 1]) {
      opts.session = argv[i + 1];
      i++;
    }
  }
  return opts;
}
