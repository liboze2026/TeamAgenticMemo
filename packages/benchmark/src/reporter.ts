import { writeFileSync } from "node:fs";
import type { BenchmarkConfig, GroupSummary, Report, TaskResult } from "./types.js";

export function aggregate(results: TaskResult[], config: BenchmarkConfig): Report {
  const groupNames = [...new Set(results.map((r) => r.group))];
  const groups: GroupSummary[] = groupNames.map((name) => {
    const rows = results.filter((r) => r.group === name);
    const wrongCount = rows.filter((r) => r.verdict === "wrong").length;
    const correctCount = rows.filter((r) => r.verdict === "correct").length;
    const neitherCount = rows.filter((r) => r.verdict === "neither").length;
    const errorCount = rows.filter((r) => r.verdict === "error").length;
    const totalTokensIn = rows.reduce((s, r) => s + r.tokensIn, 0);
    const totalTokensOut = rows.reduce((s, r) => s + r.tokensOut, 0);
    const avgDurationMs = rows.length > 0 ? rows.reduce((s, r) => s + r.durationMs, 0) / rows.length : 0;
    return { group: name, wrongCount, correctCount, neitherCount, errorCount, totalTokensIn, totalTokensOut, avgDurationMs };
  });

  const baseline = groups.find((g) => g.group === "baseline");
  const teamagent = groups.find((g) => g.group === "teamagent");
  let prr = 0;
  let tokenDeltaPercent = 0;
  let durationDeltaPercent = 0;
  if (baseline && teamagent && baseline.wrongCount > 0) {
    prr = (baseline.wrongCount - teamagent.wrongCount) / baseline.wrongCount;
  }
  if (baseline && teamagent) {
    const baseTotal = baseline.totalTokensIn + baseline.totalTokensOut;
    const teamTotal = teamagent.totalTokensIn + teamagent.totalTokensOut;
    if (baseTotal > 0) {
      tokenDeltaPercent = (teamTotal - baseTotal) / baseTotal;
    }
  }
  if (baseline && teamagent && baseline.avgDurationMs > 0) {
    durationDeltaPercent = (teamagent.avgDurationMs - baseline.avgDurationMs) / baseline.avgDurationMs;
  }

  return {
    generatedAt: new Date().toISOString(),
    config,
    groups,
    comparison: { prr, tokenDeltaPercent, durationDeltaPercent },
    rawResults: results,
  };
}

export function writeJson(report: Report, outputPath: string): void {
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
}

export function writeMarkdown(report: Report, outputPath: string): void {
  const lines: string[] = [];
  lines.push(`# Benchmark Report — ${report.generatedAt.slice(0, 10)}`);
  lines.push("");
  lines.push(`**Config**: ${report.config.groups.length} groups × runs=${report.config.runs}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Group | Wrong | Correct | Neither | Error | Tokens (in/out) | Avg Duration |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const g of report.groups) {
    lines.push(`| ${g.group} | ${g.wrongCount} | ${g.correctCount} | ${g.neitherCount} | ${g.errorCount} | ${g.totalTokensIn} / ${g.totalTokensOut} | ${g.avgDurationMs.toFixed(0)}ms |`);
  }
  lines.push("");
  lines.push(`**PRR**: ${(report.comparison.prr * 100).toFixed(1)}%`);
  lines.push(`**Token Delta**: ${(report.comparison.tokenDeltaPercent * 100).toFixed(1)}%`);
  lines.push(`**Duration Delta**: ${(report.comparison.durationDeltaPercent * 100).toFixed(1)}%`);
  lines.push("");
  lines.push("## Per-Task Breakdown");
  lines.push("");
  for (const r of report.rawResults) {
    lines.push(`- [${r.group}] ${r.taskId} run=${r.run} → **${r.verdict}** (${r.durationMs}ms${r.reason ? `, ${r.reason}` : ""})`);
  }
  writeFileSync(outputPath, lines.join("\n"));
}
