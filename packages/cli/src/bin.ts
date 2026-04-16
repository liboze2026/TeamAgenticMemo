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
import { executeReview, parseReviewArgs } from "./commands/review.js";
import {
  executeInit,
  parseInitArgs,
  renderInitResult,
} from "./commands/init.js";
import {
  disable,
  enable,
  uninstall,
  parseUninstallArgs,
  renderUninstallResult,
} from "./commands/uninstall.js";
import {
  executeCalibrate,
  parseCalibrateArgs,
  renderCalibrateResult,
} from "./commands/calibrate.js";
import {
  executeVerify,
  parseVerifyArgs,
  renderVerifyTerminal,
} from "./commands/verify.js";
import {
  executeDogfoodReport,
  parseDogfoodReportArgs,
} from "./commands/dogfood-report.js";
import { executeIngest, parseIngestArgs } from "./commands/ingest.js";

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
    case "review": {
      const opts = parseReviewArgs(rest);
      process.stdout.write(executeReview(opts));
      return;
    }
    case "init": {
      const opts = parseInitArgs(rest);
      const result = await executeInit(opts);
      process.stdout.write(renderInitResult(result));
      if (!result.ok) process.exit(1);
      return;
    }
    case "disable": {
      const r = disable();
      if (r.removed) {
        process.stdout.write(`✓ Hook 已禁用: ${r.settingsPath}\n  数据保留；用 'teamagent enable' 恢复\n`);
      } else {
        process.stdout.write(`未找到已注册的 TeamAgent hook，无需禁用\n`);
      }
      return;
    }
    case "enable": {
      const r = enable();
      if (r.alreadyInstalled) {
        process.stdout.write(`✓ Hook 已启用（无变化）: ${r.settingsPath}\n`);
      } else {
        process.stdout.write(`✅ Hook 已重新启用: ${r.settingsPath}\n  下次开 Claude Code 时生效\n`);
      }
      return;
    }
    case "uninstall": {
      const opts = parseUninstallArgs(rest);
      const r = uninstall(opts);
      process.stdout.write(renderUninstallResult(r));
      return;
    }
    case "calibrate": {
      const opts = parseCalibrateArgs(rest);
      const r = await executeCalibrate(opts);
      process.stdout.write(renderCalibrateResult(r));
      return;
    }
    case "verify": {
      const opts = parseVerifyArgs(rest);
      const { result, reportPath } = await executeVerify(opts);
      process.stdout.write(renderVerifyTerminal(result));
      if (reportPath) {
        process.stdout.write(`\n📄 详细报告: ${reportPath}\n`);
      }
      if (result.passed !== result.total) process.exit(1);
      return;
    }
    case "ingest": {
      let opts;
      try {
        opts = parseIngestArgs(rest);
      } catch (err) {
        process.stderr.write(
          `${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(1);
        return;
      }
      const output = await executeIngest(opts);
      process.stdout.write(output);
      return;
    }
    case "dogfood-report": {
      const opts = parseDogfoodReportArgs(rest);
      const r = await executeDogfoodReport(opts);
      process.stdout.write(
        `📊 自举报告生成: ${r.outputPath}\n  ${r.totalEntries} 条知识 / ${r.totalEvents} 个事件 / ${r.archivedCount} 自动归档\n`,
      );
      return;
    }
    case "migrate": {
      const dryRun = rest.includes("--dry-run");
      const { executeMigrate } = await import("./commands/migrate-v1-to-v2.js");
      const r = await executeMigrate({ dryRun });
      process.stdout.write(`Phase 1 → v2 迁移:\n`);
      process.stdout.write(`  读取条目: ${r.readEntries}\n`);
      process.stdout.write(`    personal: ${r.byScope.personal}\n`);
      process.stdout.write(`    team → personal: ${r.byScope.team}\n`);
      process.stdout.write(`    global: ${r.byScope.global}\n`);
      if (dryRun) {
        process.stdout.write(`\n(dry-run 模式，未写入 SQLite)\n`);
      } else {
        process.stdout.write(`  写入: ${r.written} 条; 拒绝: ${r.rejected} 条\n`);
        if (r.rejectionLog.length > 0) {
          for (const entry of r.rejectionLog) {
            process.stderr.write(`  rejected ${entry.id}: ${entry.reason}\n`);
          }
        }
      }
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
          "  teamagent analyze [--session=<id|path>] [--verbose] [--commit]",
          "                                   分析 Claude Code 会话日志，识别纠正时刻+成功信号",
          "                                   --commit: 通过 LLM 提取成知识条目并写入知识库 + 重编译 CLAUDE.md",
          "  teamagent review [N] [--scope=personal|team|global]",
          "                                   列出最近 N 条知识（默认 10），供人工复核",
          "  teamagent init [--dry-run] [--skip-import] [--skip-hook]",
          "                                   一键安装到当前项目：建目录 + 注入元原则 + 导入已有规则 + 注册 Hook + 编译 CLAUDE.md",
          "  teamagent disable                临时禁用 Hook（保留数据）",
          "  teamagent enable                 重新启用 Hook",
          "  teamagent uninstall [--delete-data] [--dry-run]",
          "                                   完全卸载：移除 Hook 注册 + 清掉 CLAUDE.md 区块；加 --delete-data 同时清数据",
          "  teamagent calibrate [--days=7] [--dry-run]",
          "                                   根据 events.jsonl 重算 confidence + 自动归档低分条目",
          "  teamagent verify [--report=path]",
          "                                   跑 5 个验证场景（踩坑→学习→避坑），输出 PRR/KP 指标",
          "  teamagent dogfood-report [--output=path]",
          "                                   扫 events.jsonl + knowledge.jsonl + git log，自动生成自举报告",
          "  teamagent ingest --from-insights <path> | --from-audit | --from-pr <n>",
          "                   | --from-git [--since=30d] | --from-ci [--since=30d] | --from-candidates <path>",
          "                                   多源摄入：Claude /insights / npm audit / PR review / git hotspot / CI failure",
          "                                   半自动源加 --dry-run 只产出候选 md 供人工勾选",
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
