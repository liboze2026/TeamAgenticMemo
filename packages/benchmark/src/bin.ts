#!/usr/bin/env node
import path from "node:path";
import { existsSync } from "node:fs";
import { loadTasks } from "./task-loader.js";
import { createGroupWorkdir, cleanupGroupWorkdir } from "./isolator.js";
import { ClaudeSdkRunner } from "./sdk-runner.js";
import { runTask } from "./runner.js";
import { aggregate, writeJson, writeMarkdown } from "./reporter.js";
import type { BenchmarkConfig, GroupConfig, TaskResult } from "./types.js";

function parseArgs(argv: string[]): BenchmarkConfig {
  const args = new Map<string, string>();
  for (const a of argv) {
    const m = /^--(\w[\w-]*)=(.+)$/.exec(a);
    if (m) args.set(m[1]!, m[2]!);
  }
  return {
    groups: (args.get("groups") ?? "baseline,teamagent").split(","),
    tasks: args.get("tasks") ?? "all",
    runs: Number(args.get("runs") ?? "1"),
    outputJson: args.get("output-json") ?? "bench-report.json",
    outputMarkdown: args.get("output-md") ?? "bench-report.md",
  };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const fixturesDir = path.resolve(import.meta.dirname, "..", "fixtures");
  const hookDir = path.join(repoRoot, "packages", "cli", "dist");
  const tasksGlob = config.tasks === "all"
    ? path.join(fixturesDir, "tasks", "*.json")
    : path.join(fixturesDir, "tasks", `${config.tasks}*.json`);

  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error("ERROR: ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  if (config.groups.includes("teamagent")) {
    const required = ["bin-pre-tool-use.cjs", "bin-post-tool-use.cjs", "bin-user-prompt-submit.cjs"];
    for (const f of required) {
      if (!existsSync(path.join(hookDir, f))) {
        console.error(`ERROR: hook bundle missing: ${f}\nRun: pnpm --filter @teamagent/cli build:hook`);
        process.exit(1);
      }
    }
  }

  const tasks = await loadTasks(tasksGlob);
  if (tasks.length === 0) {
    console.error(`ERROR: no tasks loaded from glob: ${tasksGlob}`);
    process.exit(1);
  }
  console.log(`Loaded ${tasks.length} tasks; ${config.groups.length} groups × ${config.runs} runs = ${tasks.length * config.groups.length * config.runs} invocations`);

  const sdk = new ClaudeSdkRunner();
  const allResults: TaskResult[] = [];
  let stepIdx = 0;
  const totalSteps = tasks.length * config.groups.length * config.runs;

  for (const groupName of config.groups) {
    const groupCfg: GroupConfig = { name: groupName, fixtureDir: path.join(fixturesDir, "groups", groupName) };
    let workdir: string;
    try {
      workdir = await createGroupWorkdir(groupCfg, hookDir);
    } catch (e) {
      console.error(`Failed to create workdir for ${groupName}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    console.log(`Group ${groupName} workdir: ${workdir}`);

    for (const task of tasks) {
      for (let run = 1; run <= config.runs; run++) {
        stepIdx++;
        process.stdout.write(`[${stepIdx}/${totalSteps}] ${groupName}/${task.id} run=${run} ... `);
        const r = await runTask(task, groupCfg, sdk, workdir, run);
        allResults.push(r);
        process.stdout.write(`${r.verdict} (${r.durationMs}ms)\n`);
      }
    }
    cleanupGroupWorkdir(workdir);
  }

  const report = aggregate(allResults, config);
  writeJson(report, config.outputJson);
  writeMarkdown(report, config.outputMarkdown);
  console.log(`\nReport written: ${config.outputJson} + ${config.outputMarkdown}`);
  console.log(`PRR: ${(report.comparison.prr * 100).toFixed(1)}%`);

  if (allResults.length > 0 && allResults.every((r) => r.verdict === "error")) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(2); });
