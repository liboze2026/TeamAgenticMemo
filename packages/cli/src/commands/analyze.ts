import os from "node:os";
import path from "node:path";
import fsSync from "node:fs";
import { ClaudeSessionSource } from "@teamagent/adapters";
import {
  ruleBasedCorrectionDetector,
  ruleBasedSuccessDetector,
  parseSessionFile,
} from "@teamagent/core";
import type { ParsedSession } from "@teamagent/types";

export interface AnalyzeOptions {
  /** 具体 session 文件路径或 sessionId；未指定则分析最近的 session */
  session?: string;
  projectsRoot?: string;
  homeDir?: string;
  /** 详细模式：列出每条信号的完整上下文 */
  verbose?: boolean;
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

  return renderReport(session, corrections, successes, sourceDesc, opts.verbose ?? false);
}

function renderReport(
  session: ParsedSession,
  corrections: ReturnType<typeof ruleBasedCorrectionDetector.detect>,
  successes: ReturnType<typeof ruleBasedSuccessDetector.detect>,
  sourceDesc: string,
  verbose: boolean,
): string {
  const lines: string[] = [];
  lines.push("📊 TeamAgent Session Analyze (dry-run，不写知识库)");
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
  lines.push("  M3 dry-run 结束，未写入知识库。M4 会加 --commit 开关。");
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
    else if (a.startsWith("--session=")) opts.session = a.slice("--session=".length);
    else if (a === "--session" && argv[i + 1]) {
      opts.session = argv[i + 1];
      i++;
    }
  }
  return opts;
}
