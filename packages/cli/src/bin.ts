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
import {
  executeCompile,
  parseCompileArgs,
  renderCompileResult,
} from "./commands/compile.js";
import { executeConfig } from "./commands/config.js";
import {
  executeDoctor,
  parseDoctorArgs,
  renderDoctorResult,
} from "./commands/doctor.js";
import {
  executeInstallPlugins,
  parseInstallPluginsArgs,
  renderInstallPluginsResult,
} from "./commands/install-plugins.js";
import { executeScanErrors, parseScanErrorsArgs } from "./commands/scan-errors.js";
import {
  executeReviewCandidates,
  parseReviewCandidatesArgs,
} from "./commands/review-candidates.js";
import {
  executeWikiPull,
  executeWikiAdd,
  executeWikiList,
  executeWikiStats,
  executeWikiSubscriptions,
  executeWikiSubscribe,
  executeWikiUnsubscribe,
  executeWikiRejected,
  executeWikiDislike,
  parseWikiArgs,
} from "./commands/wiki.js";

async function main(): Promise<void> {
  const command = process.argv[2];
  const rest = process.argv.slice(3);

  switch (command) {
    case "skeleton-demo": {
      const output = await runSkeletonDemo();
      if (output) process.stdout.write(output + "\n");
      return;
    }
    case "pitfall": {
      const nonInteractive = parsePitfallArgs(rest);
      const output = nonInteractive
        ? await executePitfall(nonInteractive)
        : await runPitfallInteractive();
      if (output) process.stdout.write(output + "\n");
      return;
    }
    case "stats": {
      const statsOpts: import("./commands/stats.js").StatsOptions = {};
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i]!;
        if (a === "--stuck-in-promotion") {
          statsOpts.stuckInPromotion = true;
        } else if (a === "--explain" && rest[i + 1]) {
          statsOpts.explain = rest[++i];
        } else if (a.startsWith("--explain=")) {
          statsOpts.explain = a.slice("--explain=".length);
        } else if (a.startsWith("--stuck-days=")) {
          statsOpts.stuckDays = parseInt(a.slice("--stuck-days=".length), 10);
        } else if (a === "--override-signals") {
          statsOpts.overrideSignals = true;
        }
      }
      process.stdout.write(executeStats(statsOpts));
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
    case "compile": {
      const opts = parseCompileArgs(rest);
      const result = await executeCompile(opts);
      process.stdout.write(renderCompileResult(result, opts.dryRun));
      return;
    }
    case "config": {
      const sub = rest[0];
      const val = rest[1];
      if (!sub || (sub !== "show" && sub !== "stop-mode")) {
        console.error('Usage: teamagent config stop-mode <sync|async>');
        console.error('       teamagent config show');
        process.exit(1);
      }
      try {
        const out = executeConfig({ subcommand: sub as "stop-mode" | "show", value: val });
        console.log(out);
      } catch (e) {
        console.error(String(e));
        process.exit(1);
      }
      break;
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
    case "scan-errors": {
      const scanOpts = parseScanErrorsArgs(rest);
      const output = await executeScanErrors(scanOpts);
      if (output) process.stdout.write(output);
      return;
    }
    case "review-candidates": {
      const reviewOpts = parseReviewCandidatesArgs(rest);
      const output = await executeReviewCandidates(reviewOpts);
      if (output) process.stdout.write(output);
      return;
    }
    case "wiki:pull": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiPull(opts);
      return;
    }
    case "wiki:add": {
      const url = rest.find(a => !a.startsWith("--"));
      if (!url) { process.stderr.write("Usage: teamagent wiki:add <url>\n"); process.exit(1); }
      const { opts } = parseWikiArgs(rest);
      await executeWikiAdd(url, opts);
      return;
    }
    case "wiki:list": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiList(opts);
      return;
    }
    case "wiki:stats": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiStats(opts);
      return;
    }
    case "wiki:subscriptions": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiSubscriptions(opts);
      return;
    }
    case "wiki:subscribe": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiSubscribe(opts);
      return;
    }
    case "wiki:unsubscribe": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiUnsubscribe(opts);
      return;
    }
    case "wiki:rejected": {
      const { opts } = parseWikiArgs(rest);
      await executeWikiRejected(opts);
      return;
    }
    case "wiki:dislike": {
      const id = rest.find(a => !a.startsWith("--"));
      if (!id) { process.stderr.write("Usage: teamagent wiki:dislike <knowledge-id>\n"); process.exit(1); }
      const { opts } = parseWikiArgs(rest);
      await executeWikiDislike(id, opts);
      return;
    }
    case "doctor": {
      const opts = parseDoctorArgs(rest);
      const result = await executeDoctor({ ...opts, cwd: process.cwd() });
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else if (!opts.postinstall || !result.allPassed) {
        process.stdout.write(renderDoctorResult(result));
      }
      if (!result.allPassed) process.exit(1);
      return;
    }
    case "install-plugins": {
      const opts = parseInstallPluginsArgs(rest);
      const result = await executeInstallPlugins(opts);
      process.stdout.write(renderInstallPluginsResult(result));
      if (!result.ok) process.exit(1);
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
          "  teamagent stats [--stuck-in-promotion] [--stuck-days=N] [--explain=<id>]",
          "                                   展示知识库统计；--stuck-in-promotion 列出卡在 probation 超 N 天的规则",
          "  teamagent demo hook <tool> <k=v>...",
          "                                   离线模拟 PreToolUse hook (例: teamagent demo hook Bash 'command=npm install moment')",
          "  teamagent install-hook           把 PreToolUse hook 注册到当前项目 .claude/settings.local.json",
          "  teamagent uninstall-hook         移除 PreToolUse hook 注册",
          "  teamagent analyze [--session=<id|path>] [--verbose] [--commit]",
          "                                   分析 Claude Code 会话日志，识别纠正时刻+成功信号",
          "                                   --commit: 通过 LLM 提取成知识条目并写入知识库 + 重编译 CLAUDE.md",
          "  teamagent review [N] [--scope=personal|team|global]",
          "                                   列出最近 N 条知识（默认 10），供人工复核",
          "  teamagent init [--dry-run] [--skip-import] [--skip-hook] [--install-plugins]",
          "                                   一键安装到当前项目：建目录 + 注入元原则 + 导入已有规则 + 注册 Hook + 编译 CLAUDE.md",
          "                                   --install-plugins: 同时注册团队标配插件（opt-in，改写用户全局 settings）",
          "  teamagent doctor [--fix] [--json]",
          "                                   诊断安装环境（Node版本/Claude Code/sqlite-vec/Hook/CLAUDE.md）",
          "                                   --fix: 自动修复能自动修的问题",
          "                                   --json: 输出机器可读 JSON",
          "  teamagent install-plugins [--dry-run] [--only=a,b] [--scope=user|project|local]",
          "                                   注册团队标配 plugins（superpowers/caveman/sales/playground）",
          "                                   通过 'claude plugin marketplace add' + 'claude plugin install' 调 CC CLI",
          "                                   默认装全部；--only 限定子集；--dry-run 只预览",
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
          "  teamagent compile [--dry-run] [--skills-only] [--markdown-only] [--force]",
          "                                   编译双出口：CLAUDE.md (canonical+, 3000 token 预算) + Agent Skills (stable+)",
          "                                   --dry-run: 预览将写/删哪些文件，不实际写入",
          "                                   --skills-only / --markdown-only: 只写其中一路出口",
          "  teamagent config stop-mode <sync|async>  切换 Stop hook 运行模式（默认 sync）",
          "  teamagent config show                    查看当前配置",
          "  teamagent scan-errors [--mode=efficient|full] [--since=<duration|ISO>] [--min-freq=N] [--dry-run] [--quiet]",
          "                                   自动采集错误信号 → 提取候选规则 → 写入候选队列",
          "  teamagent review-candidates [--limit=N]",
          "                                   交互式审核候选规则：[a]批准 [r]拒绝 [s]跳过 [q]退出",
          "  teamagent wiki:pull [--since=<duration|ISO>] [--dry-run]",
          "                                   从5个源拉取前沿知识并存入知识库",
          "  teamagent wiki:add <url>         手动添加单条 URL 到知识库",
          "  teamagent wiki:list [--limit=20] [--source=github_release|npm|rss|arxiv|manual]",
          "                                   查看已入库的 wiki 条目",
          "  teamagent wiki:stats             显示 wiki 统计数据",
          "  teamagent wiki:subscriptions     查看当前订阅源",
          "  teamagent wiki:subscribe --repo <owner/repo> | --rss <url> | --arxiv <category>",
          "                                   手动追加订阅源",
          "  teamagent wiki:unsubscribe --id <id>  退订某个源",
          "  teamagent wiki:rejected [--limit=20]  查看被拒绝的条目",
          "  teamagent wiki:dislike <id>      标记条目为不喜欢（M2.7 注入时跳过）",
          "  teamagent ingest --from-insights <path> | --from-audit | --from-pr <n>",
          "                   | --from-git [--since=30d] | --from-ci [--since=30d] | --from-candidates <path>",
          "                                   多源摄入：Claude /insights / npm audit / PR review / git hotspot / CI failure",
          "                                   半自动源加 --dry-run 只产出候选 md 供人工勾选",
          "",
          "环境变量:",
          "  TEAMAGENT_VISIBILITY=silent|smart|verbose    归因渲染模式（默认 verbose）",
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
