import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import * as readline from "node:readline";
import {
  DualLayerStore,
  SqliteCandidateQueue,
  openDb,
  MarkdownCompiler,
  makeSkillCompiler,
} from "@teamagent/adapters";
import { runCalibrationPipeline, defaultCalibrator, runCompile } from "@teamagent/core";

export interface ReviewCandidatesOptions {
  limit?: number;
  homeDir?: string;
  cwd?: string;
  candidatesDbPath?: string;
  projectDbPath?: string;
  userGlobalDbPath?: string;
  claudeMdPath?: string;
  now?: () => Date;
}

export async function executeReviewCandidates(
  opts: ReviewCandidatesOptions = {},
): Promise<string> {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const candidatesDbPath =
    opts.candidatesDbPath ?? path.join(home, ".teamagent", "candidates.db");
  const projectDbPath =
    opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath =
    opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db");
  const claudeMdPath = opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md");
  const now = opts.now ?? (() => new Date());

  if (!fs.existsSync(candidatesDbPath)) {
    return "📭 候选队列为空（candidates.db 不存在）。先运行 teamagent scan-errors。\n";
  }

  const queueDb = openDb(candidatesDbPath);
  const queue = new SqliteCandidateQueue(queueDb);
  let pending = queue.listPending();

  if (opts.limit !== undefined) {
    pending = pending.slice(0, opts.limit);
  }

  if (pending.length === 0) {
    queueDb.close();
    return "✅ 候选队列已清空，无待审核条目。\n";
  }

  fs.mkdirSync(path.dirname(projectDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(userGlobalDbPath), { recursive: true });

  const store = new DualLayerStore({ projectDbPath, userGlobalDbPath });
  const projectStore = store.getProjectStore();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  process.stdout.write(`📋 候选规则审核 — 共 ${pending.length} 条待审\n`);
  process.stdout.write("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  let approved = 0;
  let rejected = 0;
  let skipped = 0;

  for (let i = 0; i < pending.length; i++) {
    const candidate = pending[i]!;
    const e = candidate.entry;

    process.stdout.write(`\n[${i + 1}/${pending.length}] category=${e.category}  tags=[${e.tags.join(", ")}]\n`);
    process.stdout.write(`  trigger:  ${e.trigger}\n`);
    if (e.wrong_pattern) process.stdout.write(`  wrong:    ${e.wrong_pattern}\n`);
    process.stdout.write(`  correct:  ${e.correct_pattern}\n`);
    process.stdout.write(`  reason:   ${e.reasoning}\n`);
    process.stdout.write(`  来源信号: ${candidate.sourceSignals}\n`);
    process.stdout.write(`  confidence: ${e.confidence.toFixed(2)}\n`);
    process.stdout.write("\n  [a]pprove  [r]eject  [s]kip  [q]uit\n");

    const answer = (await ask("> ")).trim().toLowerCase();

    if (answer === "q") {
      process.stdout.write("\n退出审核，剩余条目保留在队列中。\n");
      break;
    }

    if (answer === "a") {
      try {
        projectStore.add(e);
        queue.updateStatus(candidate.id, "approved");
        approved++;
        process.stdout.write(`✓ 已写入知识库 (id: ${e.id})\n`);
      } catch (err) {
        process.stdout.write(`⚠ 写入失败: ${String(err).slice(0, 100)}\n`);
      }
    } else if (answer === "r") {
      queue.updateStatus(candidate.id, "rejected");
      rejected++;
      process.stdout.write("✗ 已拒绝\n");
    } else {
      queue.updateStatus(candidate.id, "skipped");
      skipped++;
      process.stdout.write("→ 已跳过（下次审核可见）\n");
    }
  }

  rl.close();

  if (approved > 0) {
    process.stdout.write("\n重新校准 + 编译 CLAUDE.md…\n");
    try {
      await runCalibrationPipeline({
        calibrator: defaultCalibrator,
        store: projectStore as any,
        events: [],
        now,
      });
      const mdCompiler = new MarkdownCompiler(claudeMdPath, () => now().toISOString());
      await runCompile({
        store,
        markdownCompiler: mdCompiler,
        skillCompiler: makeSkillCompiler(),
      });
      process.stdout.write("✓ CLAUDE.md 已更新\n");
    } catch (err) {
      process.stdout.write(`⚠ 校准/编译失败: ${String(err).slice(0, 100)}\n`);
    }
  }

  store.close();
  queueDb.close();

  return `\n审核完成: ✓批准 ${approved}  ✗拒绝 ${rejected}  →跳过 ${skipped}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
}

export function parseReviewCandidatesArgs(argv: string[]): ReviewCandidatesOptions {
  const opts: ReviewCandidatesOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--limit" && argv[i + 1]) {
      opts.limit = parseInt(argv[++i]!, 10);
    } else if (a.startsWith("--limit=")) {
      opts.limit = parseInt(a.slice("--limit=".length), 10);
    }
  }
  return opts;
}
