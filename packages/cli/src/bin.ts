#!/usr/bin/env node
import { runSkeletonDemo } from "./commands/skeleton-demo.js";

const command = process.argv[2];

switch (command) {
  case "skeleton-demo": {
    const output = runSkeletonDemo();
    if (output) process.stdout.write(output + "\n");
    break;
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
        "",
        "环境变量:",
        "  TEAMAGENT_VISIBILITY=silent|smart|verbose    归因渲染模式（默认 smart）",
        "",
      ].join("\n"),
    );
    break;
  }
  default:
    process.stderr.write(`未知命令: ${command}\n`);
    process.exit(1);
}
