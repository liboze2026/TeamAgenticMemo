import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  ClaudeSessionSource,
  ClaudeCodeLLMClient,
  DualLayerStore,
  SqliteEventLog,
  MarkdownCompiler,
  openDb,
  makeSkillCompiler,
} from "@teamagent/adapters";
import {
  ruleBasedCorrectionDetector,
  ruleBasedSuccessDetector,
  parseSessionFile,
  llmBasedKnowledgeExtractor,
  runExtractPipeline,
  defaultCalibrator,
  runCalibrationPipeline,
  runCompile,
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
  projectDbPath?: string;
  userGlobalDbPath?: string;
  /** 注入 CLAUDE.md 路径（测试用） */
  claudeMdPath?: string;
  /** events DB 路径（测试用；--commit 校准阶段会读它） */
  eventsDbPath?: string;
  cwd?: string;
  /** id 生成器（测试用） */
  idGen?: () => string;
  /** now (测试用) */
  now?: () => Date;
  /** 校准前是否运行 calibrator（默认 true）；测试时可关掉 */
  skipCalibrate?: boolean;
}

export async function executeAnalyze(opts: AnalyzeOptions = {}): Promise<string> {
  const home = opts.homeDir ?? os.homedir();
  const projectsRoot = opts.projectsRoot ?? path.join(home, ".claude", "projects");

  let session: ParsedSession;
  let sourceDesc: string;

  if (opts.session) {
    if (fs.existsSync(opts.session)) {
      const raw = fs.readFileSync(opts.session, "utf-8");
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

  const commitOutput = await runCommit(session, opts);
  return dryRun + "\n" + commitOutput;
}

async function runCommit(
  session: ParsedSession,
  opts: AnalyzeOptions,
): Promise<string> {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const projectDbPath =
    opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath =
    opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db");
  const eventsDbPath =
    opts.eventsDbPath ?? path.join(home, ".teamagent", "events.db");
  const claudeMdPath = opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md");

  fs.mkdirSync(path.dirname(projectDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(userGlobalDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(eventsDbPath), { recursive: true });

  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  const dualStore = new DualLayerStore({ projectDbPath, userGlobalDbPath });
  // Extract pipeline writes to personal (project) scope
  const projectStore = dualStore.getProjectStore();

  const now = opts.now ?? (() => new Date());
  const idGen =
    opts.idGen ??
    (() => {
      const ts = now().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
      const rand = Math.random().toString(36).slice(2, 8);
      return `pers-${ts}-${rand}`;
    });

  const recompile = async (_activeFromProject: KnowledgeEntry[]): Promise<void> => {
    await runCompile({
      store: dualStore,
      markdownCompiler: new MarkdownCompiler(claudeMdPath, () => now().toISOString()),
      skillCompiler: makeSkillCompiler(),
    });
  };

  const before = projectStore.count();
  const result = await runExtractPipeline(session, {
    detector: ruleBasedCorrectionDetector,
    extractor: llmBasedKnowledgeExtractor,
    callLLM: (prompt) => llm.complete(prompt),
    store: projectStore as any,
    recompile,
    scope: { level: "personal" },
    source: "accumulated",
    now,
    idGen,
  });

  const after = projectStore.count();

  // --- 校准阶段 ---
  let calibrationSummary = "";
  if (!opts.skipCalibrate) {
    try {
      const eventLog = new SqliteEventLog(openDb(eventsDbPath));
      const events = eventLog.readAll();

      for (const [label, store] of [
        ["personal", dualStore.getProjectStore()],
        ["global", dualStore.getGlobalStore()],
      ] as const) {
        const calResult = await runCalibrationPipeline({
          calibrator: defaultCalibrator,
          store: store as any,
          events,
          now,
        });
        for (const adj of calResult.adjusted) {
          try {
            const ts = now().toISOString();
            const rand = Math.random().toString(36).slice(2, 8);
            eventLog.append({
              id: `cal-${ts.replace(/[-:T.Z]/g, "").slice(0, 14)}-${rand}`,
              kind: "calibrator.adjusted",
              knowledge_id: adj.knowledge_id,
              confidence_before: adj.before,
              confidence_after: adj.after,
              status_after: adj.status_after,
              timestamp: ts,
              schema_version: 1,
            });
          } catch {
            // 写失败不影响主流程
          }
        }
        if (calResult.adjusted.length > 0) {
          calibrationSummary +=
            `  ${label}: 调整 ${calResult.adjusted.length} 条` +
            (calResult.archivedNew.length > 0
              ? `，归档 ${calResult.archivedNew.length} 条`
              : "") +
            "\n";
        }
      }
      eventLog.close();
      if (calibrationSummary) {
        await recompile([]);
      }
    } catch (err) {
      calibrationSummary = `  ⚠ 校准阶段失败: ${String(err).slice(0, 120)}\n`;
    }
  }

  dualStore.close();

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
  if (calibrationSummary) {
    lines.push("");
    lines.push("  校准:");
    lines.push(calibrationSummary.trimEnd());
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
