#!/usr/bin/env node
import { runSkeletonDemo } from "./commands/skeleton-demo.js";
import {
  executePitfall,
  runPitfallInteractive,
  parsePitfallArgs,
} from "./commands/pitfall.js";
import { executeStats } from "./commands/stats.js";
import { executeDemoHook, parseDemoHookArgs } from "./commands/demo-hook.js";
import { installHook, uninstallHook } from "./commands/install-hook.js";
import { executeAnalyze, parseAnalyzeArgs } from "./commands/analyze.js";

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
    case "demo": {
      // teamagent demo hook <tool> <key=value>...
      const sub = rest[0];
      if (sub === "hook") {
        const opts = parseDemoHookArgs(rest.slice(1));
        if (!opts) {
          process.stderr.write(
            "用法: teamagent demo hook <tool> <key=value>... 例: teamagent demo hook Bash 'command=npm install moment'\n",
          );
          process.exit(1);
        }
        process.stdout.write(executeDemoHook(opts));
        return;
      }
      process.stderr.write(`未知 demo 子命令: ${sub}\n`);
      process.exit(1);
      return;
    }
    case "install-hook": {
      const r = installHook();
      if (r.alreadyInstalled) {
        process.stdout.write(
          `✓ Hook 已安装（无变化）: ${r.settingsPath}\n  入口: ${r.hookEntry}\n`,
        );
      } else {
        process.stdout.write(
          `✅ Hook 已注册到 Claude Code: ${r.settingsPath}\n  入口: ${r.hookEntry}\n  下次开 Claude Code 时生效。可用 'teamagent demo hook ...' 离线测试。\n`,
        );
      }
      return;
    }
    case "uninstall-hook": {
      const r = uninstallHook();
      if (r.removed) {
        process.stdout.write(`✅ Hook 已移除: ${r.settingsPath}\n`);
      } else {
        process.stdout.write(`未找到 TeamAgent hook 注册。无需移除。\n`);
      }
      return;
    }
    case "analyze": {
      const opts = parseAnalyzeArgs(rest);
      const output = await executeAnalyze(opts);
      process.stdout.write(output);
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
          "  teamagent skeleton-demo          M0 Walking Skeleton 演示",
          "  teamagent pitfall                手动记录一条踩坑经验 (交互)",
          "  teamagent pitfall --non-interactive --trigger=... --wrong=... --correct=... --reason=...",
          "                                   非交互模式 (可选: --category=C|E|S|K --tags=a,b --level=personal|team|global --nature=objective|subjective)",
          "  teamagent stats                  展示知识库统计",
          "  teamagent demo hook <tool> <k=v>...",
          "                                   离线模拟 PreToolUse hook (例: teamagent demo hook Bash 'command=npm install moment')",
          "  teamagent install-hook           把 PreToolUse hook 注册到当前项目 .claude/settings.local.json",
          "  teamagent uninstall-hook         移除 PreToolUse hook 注册",
          "  teamagent analyze [--session=<id|path>] [--verbose]",
          "                                   分析 Claude Code 会话日志，识别纠正时刻+成功信号（dry-run，不写入）",
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
