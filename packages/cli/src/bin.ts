#!/usr/bin/env node
import { runSkeletonDemo } from "./commands/skeleton-demo.js";
import {
  executePitfall,
  runPitfallInteractive,
  parsePitfallArgs,
} from "./commands/pitfall.js";
import { executeStats } from "./commands/stats.js";

async function main(): Promise<void> {
  const command = process.argv[2];
  const rest = process.argv.slice(3);

  switch (command) {
    case "skeleton-demo": {
      const output = runSkeletonDemo();
      if (output) process.stdout.write(output + "\n");
      return;
    }
    case "pitfall": {
      const nonInteractive = parsePitfallArgs(rest);
      const output = nonInteractive
        ? executePitfall(nonInteractive)
        : await runPitfallInteractive();
      if (output) process.stdout.write(output + "\n");
      return;
    }
    case "stats": {
      process.stdout.write(executeStats());
      return;
    }
    case undefined:
    case "--help":
    case "-h":
    case "help": {
      process.stdout.write(
        [
          "teamagent — TeamAgent CLI",
          "",
          "用法:",
          "  teamagent skeleton-demo    M0 Walking Skeleton 演示",
          "  teamagent pitfall          手动记录一条踩坑经验 (交互)",
          "  teamagent pitfall --non-interactive --trigger=... --wrong=... --correct=... --reason=...",
          "                             非交互模式 (可选: --category=C|E|S|K --tags=a,b --level=personal|team|global --nature=objective|subjective)",
          "  teamagent stats            展示知识库统计（按 scope/category，Top 5 命中，最近 5 条）",
          "",
          "环境变量:",
          "  TEAMAGENT_VISIBILITY=silent|smart|verbose    归因渲染模式（默认 smart）",
          "",
        ].join("\n"),
      );
      return;
    }
    default:
      process.stderr.write(`未知命令: ${command}\n`);
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
