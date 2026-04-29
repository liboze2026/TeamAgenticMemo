#!/usr/bin/env node
import {
  executeInit,
  executeInstallPlugins,
  parseInitArgs,
  parseInstallPluginsArgs,
  renderInitResult,
  renderInstallPluginsResult
} from "./chunk-BJTPZXEY.js";
import {
  executeCompile,
  parseCompileArgs,
  renderCompileResult
} from "./chunk-NP6JVOFQ.js";
import {
  executePitfall,
  parsePitfallArgs,
  runPitfallInteractive
} from "./chunk-K6ZFV5X6.js";
import "./chunk-XG7FTPKD.js";
import {
  ClaudeCodeLLMClient,
  ClaudeSessionSource,
  CompositeErrorSignalCollector,
  InMemoryAttributionBus,
  InMemoryKnowledgeStore,
  MarkdownCompiler,
  SqliteCandidateQueue,
  SqliteEventLog,
  StdoutRenderer,
  XenovaRuleEmbedder,
  createPreToolUseHandler,
  makeSkillCompiler,
  normalizeCwd
} from "./chunk-NAWUQDTY.js";
import {
  DualLayerStore,
  syncRuleVectors
} from "./chunk-KGB2IXNQ.js";
import {
  openDb
} from "./chunk-UQ5KOJUO.js";
import {
  buildErrorBatches,
  compileMarkdownBlock,
  defaultCalibrator,
  defaultValidator,
  detectStack,
  filterSignals,
  formatAsAgentSkill,
  llmBasedKnowledgeExtractor,
  matchRules,
  matchRules2,
  parseSessionFile,
  ruleBasedCorrectionDetector,
  ruleBasedSuccessDetector,
  runCalibrationPipeline,
  runCalibrationPipelineV2,
  runCompile,
  runExtractPipeline,
  runIngestPipeline,
  runVerify,
  v2Calibrator,
  validateLevel0
} from "./chunk-VASCS3RI.js";
import {
  external_exports,
  parseVisibilityMode
} from "./chunk-4EBMEK5Z.js";
import {
  installHook,
  uninstallHook
} from "./chunk-MKFSZQXM.js";
import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/bin.ts
init_esm_shims();
import fs17 from "fs";
import path18 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// ../cli/src/commands/skeleton-demo.ts
init_esm_shims();
async function runSkeletonDemo(opts = {}) {
  const env = opts.env ?? process.env;
  const now = opts.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const mode = parseVisibilityMode(env.TEAMAGENT_VISIBILITY);
  const store = new InMemoryKnowledgeStore();
  const bus = new InMemoryAttributionBus();
  const entry = {
    id: "skeleton-demo-001",
    scope: { level: "personal" },
    category: "K",
    tags: ["metacognition", "skeleton"],
    type: "practice",
    nature: "subjective",
    trigger: "\u9047\u5230\u9884\u671F\u5916\u7684\u72B6\u6001",
    wrong_pattern: "",
    correct_pattern: "\u5148\u505C\u4E0B\u67E5\u6E05\u695A\u6839\u56E0\uFF0C\u518D\u52A8\u624B",
    reasoning: "\u7ED5\u8FC7\u5F0F\u4FEE\u590D\u7ECF\u5E38\u63A9\u76D6\u771F\u95EE\u9898",
    confidence: 0.8,
    enforcement: "suggest",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: now,
    last_hit_at: "",
    last_validated_at: now,
    source: "preset",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0
  };
  store.add(entry);
  const block = compileMarkdownBlock(store.getAll(), now);
  const lineCount = block.split("\n").length;
  bus.emit({
    source: "skeleton",
    action: "[skeleton] \u6DFB\u52A0\u6A21\u62DF\u77E5\u8BC6 + \u6A21\u62DF\u7F16\u8BD1",
    severity: "highlight",
    timestamp: now,
    target: { id: entry.id, count: store.count() },
    before: { knowledgeCount: 0 },
    after: { knowledgeCount: store.count(), blockLines: lineCount },
    userFacingValue: `\u6A21\u62DF\u77E5\u8BC6\u6761\u76EE\u5DF2\u7F16\u8BD1\u6210 ${lineCount} \u884C markdown\uFF0C\u771F\u5B9E\u573A\u666F\u4E0B\u4F1A\u5199\u5165 CLAUDE.md`,
    counterfactual: "\u6CA1\u6709 Walking Skeleton \u7684\u9AA8\u67B6\u8D2F\u901A\uFF0C\u540E\u7EED Milestone \u6CA1\u6709\u843D\u811A\u70B9"
  });
  const badEntry = {
    id: "skeleton-demo-bad",
    scope: { level: "team", paths: [] },
    // 空 paths 会触发 scope_paths_empty
    type: "avoidance",
    trigger: "bad-rule",
    wrong_pattern: "nonexistent-pattern",
    correct_pattern: "c"
  };
  const l0 = defaultValidator.validateLevel0({
    entry: badEntry,
    sourceText: "nothing matches here",
    existingRules: [],
    projectStack: ["ts"]
  });
  bus.emit({
    source: "validator",
    action: "[skeleton] L0 \u62D2\u7EDD\u6F14\u793A",
    severity: l0.ok ? "info" : "warning",
    timestamp: now,
    target: { id: "skeleton-demo-bad" },
    userFacingValue: l0.ok ? "\uFF08\u51FA\u4E4E\u610F\u6599\uFF1AL0 \u95E8\u53E3\u6CA1\u62E6\u4F4F\u8FD9\u6761\u574F\u6761\u76EE\uFF09" : `L0 \u5982\u9884\u671F\u62E6\u4E0B\uFF1A${l0.failed_checks.join(", ")}`,
    counterfactual: "\u6CA1\u6709 L0 \u95E8\u95F8\uFF0C\u574F\u6761\u76EE\u4F1A\u6C61\u67D3\u77E5\u8BC6\u5E93"
  });
  const canonicalEntry = {
    ...entry,
    id: "skeleton-demo-canonical",
    trigger: "use-fetch-not-axios",
    correct_pattern: "fetch",
    wrong_pattern: "axios",
    reasoning: "\u9879\u76EE\u7EDF\u4E00\u539F\u751F fetch\uFF0C\u51CF\u5C11\u4F9D\u8D56",
    current_tier: "canonical",
    max_tier_ever: "canonical"
  };
  const stableEntry = {
    ...entry,
    id: "skeleton-demo-stable",
    trigger: "batch-insert-over-loop",
    correct_pattern: "batch insert",
    wrong_pattern: "for.*insert",
    reasoning: "\u6279\u91CF\u63D2\u5165\u907F\u514D\u9010\u6761\u5F80\u8FD4\u5F00\u9500",
    current_tier: "stable",
    max_tier_ever: "stable"
  };
  store.add(canonicalEntry);
  store.add(stableEntry);
  const mdCompilerStub = {
    compile(entries) {
      return compileMarkdownBlock(entries, now, { tierFilter: ["canonical", "enforced"] });
    },
    writeToFile(entries) {
      const content = compileMarkdownBlock(entries, now, { tierFilter: ["canonical", "enforced"] });
      return { filePath: "(demo: CLAUDE.md)", blockLineCount: content.split("\n").length, blockStartLine: 0 };
    }
  };
  const STABLE_PLUS = /* @__PURE__ */ new Set(["stable", "canonical", "enforced"]);
  const skillCompilerStub = {
    compile(entries) {
      return entries.filter((e) => e.status === "active" && STABLE_PLUS.has(e.current_tier)).map((e) => ({ ruleId: e.id, dirname: e.id, skillMd: formatAsAgentSkill(e) }));
    },
    async write(artifacts) {
      return { written: artifacts.map((a) => a.ruleId), skipped: [] };
    },
    async cleanup(ids) {
      return { removed: ids };
    }
  };
  const compileResult = await runCompile({
    store,
    markdownCompiler: mdCompilerStub,
    skillCompiler: skillCompilerStub,
    bus,
    dryRun: true
  });
  bus.emit({
    source: "compile",
    action: "[skeleton] \u53CC\u51FA\u53E3\u7F16\u8BD1\u6F14\u793A",
    severity: "highlight",
    timestamp: now,
    userFacingValue: [
      `CLAUDE.md \u51FA\u53E3\uFF1Acanonical+ \u89C4\u5219 ${compileResult.markdown.blockLineCount} \u884C\uFF08dry-run\uFF0C\u672A\u5B9E\u9645\u5199\u5165\uFF09`,
      `Skills \u51FA\u53E3\uFF1Astable+ \u89C4\u5219 ${compileResult.skills.written.length} \u6761 \u2192 ~/.claude/skills/teamagent/ \u76EE\u5F55\uFF08dry-run\uFF0C\u672A\u5B9E\u9645\u5199\u5165\uFF09`,
      `  \u5BFC\u51FA skill: [${compileResult.skills.written.join(", ")}]`
    ].join("\n  "),
    counterfactual: "\u6CA1\u6709\u53CC\u51FA\u53E3\u7F16\u8BD1\uFF0C\u89C4\u5219\u65E0\u6CD5\u4F5C\u4E3A Claude Code skill \u88AB\u6240\u6709\u9879\u76EE\u590D\u7528"
  });
  const renderer = new StdoutRenderer();
  return renderer.render(bus.drain(), mode);
}

// ../cli/src/commands/stats.ts
init_esm_shims();
import os from "os";
import path from "path";
import fs from "fs";
function resolvePaths(opts) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    projectDbPath: opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath: opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db"),
    eventsDbPath: opts.eventsDbPath ?? path.join(home, ".teamagent", "events.db")
  };
}
function aggregateConfidenceMovements(events, windowDays, now) {
  const cutoff = now.getTime() - windowDays * 24 * 3600 * 1e3;
  const recent = events.filter((e) => {
    if (e.kind !== "calibrator.adjusted") return false;
    if (!e.knowledge_id) return false;
    if (typeof e.confidence_before !== "number") return false;
    if (typeof e.confidence_after !== "number") return false;
    try {
      return new Date(e.timestamp).getTime() >= cutoff;
    } catch {
      return false;
    }
  });
  const byId = /* @__PURE__ */ new Map();
  for (const e of recent) {
    const id = e.knowledge_id;
    const delta = e.confidence_after - e.confidence_before;
    const existing = byId.get(id);
    if (existing) {
      existing.totalDelta += delta;
      if (e.status_after === "archived") existing.archivedThisWindow = true;
    } else {
      byId.set(id, {
        knowledge_id: id,
        totalDelta: delta,
        archivedThisWindow: e.status_after === "archived"
      });
    }
  }
  return [...byId.values()].sort(
    (a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta)
  );
}
function renderStats(byScope, movements = [], windowDays = 7) {
  const all = [...byScope.personal, ...byScope.team, ...byScope.global];
  const active = all.filter((e) => e.status === "active");
  const archived = all.filter((e) => e.status === "archived");
  if (all.length === 0) {
    return [
      "\u{1F4CA} TeamAgent \u77E5\u8BC6\u5E93\u7EDF\u8BA1",
      "",
      "\u5C1A\u65E0\u77E5\u8BC6\u6761\u76EE\u3002",
      "",
      "\u5F55\u5165\u65B9\u5F0F:",
      "  pnpm teamagent pitfall            \u4EA4\u4E92\u5F0F\u5F55\u5165",
      "  pnpm teamagent pitfall --non-interactive --trigger=... --wrong=... --correct=... --reason=...",
      ""
    ].join("\n");
  }
  const byCategory = { C: 0, E: 0, S: 0, K: 0 };
  for (const e of active) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  const byScopeLevel = {
    personal: byScope.personal.filter((e) => e.status === "active").length,
    team: byScope.team.filter((e) => e.status === "active").length,
    global: byScope.global.filter((e) => e.status === "active").length
  };
  const topHits = active.filter((e) => e.hit_count > 0).sort((a, b) => b.hit_count - a.hit_count).slice(0, 5);
  const recent = active.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const lines = [];
  lines.push("\u{1F4CA} TeamAgent \u77E5\u8BC6\u5E93\u7EDF\u8BA1");
  lines.push("");
  lines.push(
    `\u603B\u6570: ${all.length} (\u6D3B\u8DC3 ${active.length}${archived.length > 0 ? `, \u5F52\u6863 ${archived.length}` : ""})`
  );
  lines.push("");
  lines.push("\u6309\u4F5C\u7528\u57DF:");
  lines.push(`  personal  ${byScopeLevel.personal}`);
  lines.push(`  team      ${byScopeLevel.team}`);
  lines.push(`  global    ${byScopeLevel.global}`);
  lines.push("");
  lines.push("\u6309\u5206\u7C7B:");
  lines.push(`  C \u4EE3\u7801\u5C42  ${byCategory.C}`);
  lines.push(`  E \u5DE5\u7A0B\u5C42  ${byCategory.E}`);
  lines.push(`  S \u7B56\u7565\u5C42  ${byCategory.S}`);
  lines.push(`  K \u8BA4\u77E5\u5C42  ${byCategory.K}`);
  lines.push("");
  if (topHits.length > 0) {
    lines.push(`Top ${topHits.length} \u9AD8\u9891\u547D\u4E2D:`);
    for (const e of topHits) {
      lines.push(
        `  [${e.hit_count}\u6B21] ${e.trigger} \u2192 ${e.correct_pattern} (conf=${e.confidence.toFixed(2)})`
      );
    }
    lines.push("");
  }
  lines.push(`\u6700\u8FD1 ${recent.length} \u6761\u65B0\u589E:`);
  for (const e of recent) {
    const date = e.created_at.slice(0, 10);
    lines.push(`  [${date}] ${e.category}/${e.tags[0] ?? "-"}  ${e.trigger}`);
  }
  if (movements.length > 0) {
    lines.push("");
    lines.push(`\u672C\u5468\uFF08${windowDays} \u5929\uFF09confidence \u53D8\u5316 top ${Math.min(5, movements.length)}:`);
    const triggerById = /* @__PURE__ */ new Map();
    for (const e of all) triggerById.set(e.id, e.trigger);
    for (const m of movements.slice(0, 5)) {
      const sign = m.totalDelta > 0 ? "+" : "";
      const tag = m.archivedThisWindow ? " [\u81EA\u52A8\u5F52\u6863]" : "";
      const trig = triggerById.get(m.knowledge_id) ?? "(\u5DF2\u5220)";
      lines.push(
        `  ${sign}${m.totalDelta.toFixed(2)}  ${m.knowledge_id}${tag}`
      );
      lines.push(`         ${trig.slice(0, 80)}`);
    }
  }
  return lines.join("\n") + "\n";
}
function renderExplain(entry, id) {
  if (!entry) {
    return `rule ${id} not found
`;
  }
  const debitUpdated = entry.demerit_last_updated || "never";
  const lines = [
    `rule ${entry.id}`,
    `  tier: ${entry.current_tier} (max ever: ${entry.max_tier_ever})`,
    `  confidence: ${entry.confidence.toFixed(3)}`,
    `  demerit: ${entry.demerit.toFixed(2)} (updated ${debitUpdated})`
  ];
  return lines.join("\n") + "\n";
}
function findStuckInPromotion(entries, stuckDays, now) {
  const cutoffMs = now.getTime() - stuckDays * 24 * 3600 * 1e3;
  return entries.filter((e) => {
    if (e.status !== "active") return false;
    if (e.current_tier !== "probation") return false;
    const enteredAt = e.tier_entered_at || e.created_at;
    if (!enteredAt) return true;
    try {
      return new Date(enteredAt).getTime() <= cutoffMs;
    } catch {
      return false;
    }
  });
}
function renderStuckInPromotion(stuck, stuckDays, now) {
  if (stuck.length === 0) {
    return `\u{1F4CC} stuck-in-promotion: \u65E0\u89C4\u5219\u5361\u5728 probation \u8D85 ${stuckDays} \u5929
`;
  }
  const lines = [];
  lines.push(`\u{1F4CC} stuck-in-promotion\uFF08probation tier > ${stuckDays} \u5929\uFF0C\u5171 ${stuck.length} \u6761\uFF09:`);
  lines.push("");
  const COL_ID = 24;
  const COL_DAYS = 6;
  lines.push(
    `  ${"ID".padEnd(COL_ID)} ${"\u5929\u6570".padStart(COL_DAYS)}  Trigger`
  );
  lines.push("  " + "\u2500".repeat(COL_ID + COL_DAYS + 14));
  for (const e of stuck) {
    const enteredAt = e.tier_entered_at || e.created_at;
    let days = "?";
    if (enteredAt) {
      try {
        const d = Math.floor((now.getTime() - new Date(enteredAt).getTime()) / (24 * 3600 * 1e3));
        days = String(d);
      } catch {
      }
    }
    lines.push(
      `  ${e.id.padEnd(COL_ID)} ${days.padStart(COL_DAYS)}  ${e.trigger.slice(0, 60)}`
    );
  }
  lines.push("");
  return lines.join("\n");
}
function renderOverrideSignals(events) {
  const counts = /* @__PURE__ */ new Map();
  for (const e of events) {
    if (e.kind !== "ai.override.ignored" && e.kind !== "ai.override.complied") continue;
    const id = e.knowledge_id ?? "(unknown)";
    const entry = counts.get(id) ?? { ignored: 0, complied: 0 };
    if (e.kind === "ai.override.ignored") entry.ignored++;
    else entry.complied++;
    counts.set(id, entry);
  }
  if (counts.size === 0) {
    return "TeamAgent Override Signals\n\n  (\u65E0\u8BB0\u5F55)\n";
  }
  const rows = [...counts.entries()].sort((a, b) => b[1].ignored - a[1].ignored);
  const lines = ["TeamAgent Override Signals", ""];
  lines.push(
    "  Rule ID".padEnd(32) + "ignored".padEnd(10) + "complied"
  );
  lines.push("  " + "\u2500".repeat(50));
  for (const [id, { ignored, complied }] of rows) {
    lines.push(
      `  ${id.slice(0, 30).padEnd(32)}ignored: ${String(ignored).padEnd(6)}complied: ${complied}`
    );
  }
  lines.push("");
  return lines.join("\n");
}
function executeStats(opts = {}) {
  const paths = resolvePaths(opts);
  const windowDays = opts.windowDays ?? 7;
  const now = (opts.now ?? (() => /* @__PURE__ */ new Date()))();
  if (opts.stuckInPromotion) {
    const stuckDays = opts.stuckDays ?? 14;
    let allEntries = [];
    try {
      const projectDbExists = fs.existsSync(paths.projectDbPath);
      const globalDbExists = fs.existsSync(paths.userGlobalDbPath);
      if (projectDbExists || globalDbExists) {
        fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
        fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
        const store = new DualLayerStore({
          projectDbPath: paths.projectDbPath,
          userGlobalDbPath: paths.userGlobalDbPath
        });
        allEntries = store.getAll();
        store.close();
      }
    } catch {
    }
    const stuck = findStuckInPromotion(allEntries, stuckDays, now);
    return renderStuckInPromotion(stuck, stuckDays, now);
  }
  if (opts.overrideSignals) {
    let events2 = [];
    try {
      if (fs.existsSync(paths.eventsDbPath)) {
        const eventLog = new SqliteEventLog(openDb(paths.eventsDbPath));
        events2 = eventLog.readAll();
        eventLog.close();
      }
    } catch {
    }
    return renderOverrideSignals(events2);
  }
  if (opts.explain !== void 0) {
    const id = opts.explain;
    let entry;
    try {
      const projectDbExists = fs.existsSync(paths.projectDbPath);
      const globalDbExists = fs.existsSync(paths.userGlobalDbPath);
      if (projectDbExists || globalDbExists) {
        fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
        fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
        const store = new DualLayerStore({
          projectDbPath: paths.projectDbPath,
          userGlobalDbPath: paths.userGlobalDbPath
        });
        entry = store.getById(id);
        store.close();
      }
    } catch {
    }
    return renderExplain(entry, id);
  }
  let events = [];
  try {
    if (fs.existsSync(paths.eventsDbPath)) {
      const eventLog = new SqliteEventLog(openDb(paths.eventsDbPath));
      events = eventLog.readAll();
      eventLog.close();
    }
  } catch {
  }
  const movements = aggregateConfidenceMovements(events, windowDays, now);
  let personal = [];
  let team = [];
  let global = [];
  try {
    const projectDbExists = fs.existsSync(paths.projectDbPath);
    const globalDbExists = fs.existsSync(paths.userGlobalDbPath);
    if (projectDbExists || globalDbExists) {
      fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
      fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
      const store = new DualLayerStore({
        projectDbPath: paths.projectDbPath,
        userGlobalDbPath: paths.userGlobalDbPath
      });
      const all = store.getAll();
      store.close();
      personal = all.filter((e) => e.scope.level === "personal");
      team = all.filter((e) => e.scope.level === "team");
      global = all.filter((e) => e.scope.level === "global");
    }
  } catch {
  }
  return renderStats(
    { personal, team, global },
    movements,
    windowDays
  );
}

// ../cli/src/commands/demo-hook.ts
init_esm_shims();
import os2 from "os";
import path2 from "path";
import nodeFs from "fs";
function formatBlockReason(rule) {
  return [
    `\u{1F6AB} TeamAgent \u62E6\u622A (\u7F6E\u4FE1 ${rule.confidence.toFixed(2)})`,
    `\u5E94\u6539\u7528: ${rule.correct_pattern}`,
    `\u539F\u56E0: ${rule.reasoning}`,
    `(\u89C4\u5219 id: ${rule.id})`
  ].join("\n");
}
function formatWarnMessage(rule) {
  return [
    `\u{1F4A1} TeamAgent \u7ECF\u9A8C (\u7F6E\u4FE1 ${rule.confidence.toFixed(2)})`,
    `\u63A8\u8350: ${rule.correct_pattern}`,
    `\u539F\u56E0: ${rule.reasoning}`
  ].join("\n");
}
function executeDemoHook(opts) {
  const cwd = normalizeCwd(opts.cwd ?? process.cwd());
  const home = opts.homeDir ?? os2.homedir();
  const projectDbPath = opts.projectDbPath ?? path2.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath = opts.userGlobalDbPath ?? path2.join(home, ".teamagent", "global.db");
  const effectiveProject = nodeFs.existsSync(projectDbPath) ? projectDbPath : ":memory:";
  const effectiveGlobal = nodeFs.existsSync(userGlobalDbPath) ? userGlobalDbPath : ":memory:";
  let rules = [];
  try {
    const store = new DualLayerStore({
      projectDbPath: effectiveProject,
      userGlobalDbPath: effectiveGlobal
    });
    rules = store.findActive();
    store.close();
  } catch {
  }
  const matches = matchRules({ toolName: opts.toolName, input: opts.toolInput }, rules);
  if (matches.length === 0) {
    return [
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      "\u{1F7E2} TeamAgent \xB7 \u6A21\u62DF PreToolUse \u7ED3\u679C",
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      `\u25B8 \u5DE5\u5177: ${opts.toolName}`,
      `\u25B8 \u8F93\u5165: ${JSON.stringify(opts.toolInput)}`,
      "\u25B8 \u51B3\u7B56: \u901A\u8FC7 (\u65E0\u89C4\u5219\u547D\u4E2D)",
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      ""
    ].join("\n");
  }
  const top = matches[0];
  if (top.enforcement === "block") {
    const reason = formatBlockReason(top);
    return [
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      "\u{1F6AB} TeamAgent \xB7 \u6A21\u62DF PreToolUse \u7ED3\u679C",
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      `\u25B8 \u5DE5\u5177: ${opts.toolName}`,
      `\u25B8 \u8F93\u5165: ${JSON.stringify(opts.toolInput)}`,
      "\u25B8 \u51B3\u7B56: deny",
      "\u25B8 \u62E6\u622A\u539F\u56E0:",
      ...reason.split("\n").map((ln) => `    ${ln}`),
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      ""
    ].join("\n");
  }
  if (top.enforcement === "warn") {
    const msg = formatWarnMessage(top);
    return [
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      "\u{1F4A1} TeamAgent \xB7 \u6A21\u62DF PreToolUse \u7ED3\u679C",
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      `\u25B8 \u5DE5\u5177: ${opts.toolName}`,
      `\u25B8 \u8F93\u5165: ${JSON.stringify(opts.toolInput)}`,
      "\u25B8 \u51B3\u7B56: allow",
      "\u25B8 \u7ED9 AI \u7684\u63D0\u793A:",
      ...msg.split("\n").map((ln) => `    ${ln}`),
      `\u25B8 \u9644\u52A0\u4E0A\u4E0B\u6587: ${top.correct_pattern}`,
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
      ""
    ].join("\n");
  }
  return [
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
    "\u{1F7E2} TeamAgent \xB7 \u6A21\u62DF PreToolUse \u7ED3\u679C",
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
    `\u25B8 \u5DE5\u5177: ${opts.toolName}`,
    `\u25B8 \u8F93\u5165: ${JSON.stringify(opts.toolInput)}`,
    "\u25B8 \u51B3\u7B56: \u901A\u8FC7 (\u65E0\u89C4\u5219\u547D\u4E2D)",
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
    ""
  ].join("\n");
}
function parseDemoHookArgs(args) {
  if (args.length === 0) return null;
  const toolName = args[0];
  const toolInput = {};
  for (const a of args.slice(1)) {
    const idx = a.indexOf("=");
    if (idx < 0) continue;
    const k = a.slice(0, idx);
    const v = a.slice(idx + 1);
    try {
      toolInput[k] = JSON.parse(v);
    } catch {
      toolInput[k] = v;
    }
  }
  return { toolName, toolInput };
}

// ../cli/src/commands/install-user-hook.ts
init_esm_shims();
import fs2 from "fs";
import path3 from "path";
import os3 from "os";
import { fileURLToPath } from "url";
var SESSION_START_TAG = "teamagent-session-start";
function toForwardSlash(p) {
  return p.replace(/\\/g, "/");
}
function shellQuote(p) {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}
function defaultSessionStartEntry() {
  const here = fileURLToPath(import.meta.url);
  let dir = path3.dirname(here);
  for (let i = 0; i < 6; i++) {
    if (fs2.existsSync(path3.join(dir, "dist", "bin-session-start.cjs"))) {
      return path3.join(dir, "dist", "bin-session-start.cjs");
    }
    const parent = path3.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path3.join(path3.dirname(path3.dirname(here)), "bin-session-start.cjs");
}
function installUserHook(opts = {}) {
  const home = opts.homeDir ?? os3.homedir();
  const settingsPath = path3.join(home, ".claude", "settings.json");
  const hookEntry = opts.sessionStartEntry ?? defaultSessionStartEntry();
  if (!fs2.existsSync(hookEntry)) {
    throw new Error(
      `SessionStart bundle not found: ${hookEntry}
\u8BF7\u786E\u8BA4 teamagent \u5DF2\u6B63\u786E\u5B89\u88C5 (dist/bin-session-start.cjs \u5B58\u5728)`
    );
  }
  fs2.mkdirSync(path3.dirname(settingsPath), { recursive: true });
  let backupPath = null;
  if (fs2.existsSync(settingsPath)) {
    const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    backupPath = `${settingsPath}.bak-${ts}`;
    fs2.copyFileSync(settingsPath, backupPath);
  }
  const raw = fs2.existsSync(settingsPath) ? fs2.readFileSync(settingsPath, "utf-8").trim() : "";
  const settings = raw ? JSON.parse(raw) : {};
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  const before = settings.hooks.SessionStart.length;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    (h) => !isTeamagentSessionStartEntry(h)
  );
  const removedLegacy = before - settings.hooks.SessionStart.length;
  const alreadyInstalled = removedLegacy > 0;
  settings.hooks.SessionStart.push({
    _teamagentTag: SESSION_START_TAG,
    hooks: [
      {
        type: "command",
        command: `node ${shellQuote(toForwardSlash(hookEntry))}`,
        timeout: 10
      }
    ]
  });
  fs2.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  return { settingsPath, backupPath, hookEntry, alreadyInstalled };
}
function isTeamagentSessionStartEntry(entry) {
  if (entry._teamagentTag === SESSION_START_TAG) return true;
  const cmds = entry.hooks?.map((c) => c.command ?? "") ?? [];
  return cmds.some((c) => c.includes("bin-session-start.cjs"));
}
function uninstallUserHook(opts = {}) {
  const home = opts.homeDir ?? os3.homedir();
  const settingsPath = path3.join(home, ".claude", "settings.json");
  if (!fs2.existsSync(settingsPath)) return { settingsPath, removed: false };
  const raw = fs2.readFileSync(settingsPath, "utf-8").trim();
  if (!raw) return { settingsPath, removed: false };
  const settings = JSON.parse(raw);
  if (!settings.hooks?.SessionStart) return { settingsPath, removed: false };
  const before = settings.hooks.SessionStart.length;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    (h) => !isTeamagentSessionStartEntry(h)
  );
  const changed = settings.hooks.SessionStart.length !== before;
  if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  if (settings.hooks && Object.keys(settings.hooks).length === 0)
    delete settings.hooks;
  fs2.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  return { settingsPath, removed: changed };
}

// ../cli/src/commands/analyze.ts
init_esm_shims();
import os4 from "os";
import path4 from "path";
import fs3 from "fs";
function hasAnyValidJsonlLine(raw) {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
    }
  }
  return false;
}
async function executeAnalyze(opts = {}) {
  const home = opts.homeDir ?? os4.homedir();
  const projectsRoot = opts.projectsRoot ?? path4.join(home, ".claude", "projects");
  let session;
  let sourceDesc;
  if (opts.session) {
    if (fs3.existsSync(opts.session)) {
      const raw = fs3.readFileSync(opts.session, "utf-8");
      if (raw.trim().length > 0 && !hasAnyValidJsonlLine(raw)) {
        return [
          `# transcript parse failed`,
          ``,
          `\u8DEF\u5F84: ${opts.session}`,
          `\u75C7\u72B6: \u6587\u4EF6\u975E\u7A7A\uFF08${raw.length} \u5B57\u8282\uFF09\u4F46\u672A\u53D1\u73B0\u53EF\u89E3\u6790\u7684 JSONL \u6D88\u606F\u3002`,
          `\u5E38\u89C1\u539F\u56E0: \u6587\u4EF6\u88AB\u5916\u90E8\u5DE5\u5177\u622A\u65AD/\u635F\u574F\uFF0C\u6216\u4E0D\u662F Claude Code \u4F1A\u8BDD\u65E5\u5FD7\u683C\u5F0F\u3002`,
          `\u64CD\u4F5C: \u68C0\u67E5\u6587\u4EF6\u9996\u884C\u662F\u5426\u4E3A\u5408\u6CD5 JSON\uFF08\u5E94\u6709 {"type":"user"...} \u7B49\u7ED3\u6784\uFF09\u3002`,
          ``
        ].join("\n");
      }
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
        "\u672A\u627E\u5230\u4EFB\u4F55\u4F1A\u8BDD\u65E5\u5FD7 (~/.claude/projects/ \u4E3A\u7A7A)\u3002",
        "\u5148\u7528 Claude Code \u5F00\u51E0\u6B21\u4F1A\u8BDD\u518D\u8DD1 teamagent analyze\u3002",
        ""
      ].join("\n");
    }
    session = await src.loadById(recent[0].sessionId);
    sourceDesc = `\u6700\u8FD1\u4F1A\u8BDD ${recent[0].sessionId}`;
  }
  const rawCorrections = ruleBasedCorrectionDetector.detect(session);
  const rawSuccesses = ruleBasedSuccessDetector.detect(session);
  const fromTi = opts.fromTurnIndex;
  const corrections = fromTi !== void 0 ? rawCorrections.filter((m) => m.turnIndex > fromTi) : rawCorrections;
  const successes = fromTi !== void 0 ? rawSuccesses.filter((m) => m.turnIndex > fromTi) : rawSuccesses;
  const dryRun = renderReport(
    session,
    corrections,
    successes,
    sourceDesc,
    opts.verbose ?? false,
    opts.commit === true
  );
  const lastTurnIndex = session.turns.length > 0 ? session.turns[session.turns.length - 1].turnIndex : -1;
  if (!opts.commit) {
    opts.onMeta?.({
      sessionId: session.sessionId,
      lastTurnIndex,
      correctionsFound: corrections.length,
      extracted: 0,
      skipped: 0,
      failed: 0,
      rejected: 0,
      deduped: 0,
      newEntries: []
    });
    return dryRun;
  }
  const { output: commitOutput, meta } = await runCommit(session, opts);
  opts.onMeta?.({
    sessionId: session.sessionId,
    lastTurnIndex,
    ...meta
  });
  return dryRun + "\n" + commitOutput;
}
async function runCommit(session, opts) {
  const home = opts.homeDir ?? os4.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const projectDbPath = opts.projectDbPath ?? path4.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath = opts.userGlobalDbPath ?? path4.join(home, ".teamagent", "global.db");
  const eventsDbPath = opts.eventsDbPath ?? path4.join(home, ".teamagent", "events.db");
  const claudeMdPath = opts.claudeMdPath ?? path4.join(cwd, "CLAUDE.md");
  fs3.mkdirSync(path4.dirname(projectDbPath), { recursive: true });
  fs3.mkdirSync(path4.dirname(userGlobalDbPath), { recursive: true });
  fs3.mkdirSync(path4.dirname(eventsDbPath), { recursive: true });
  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  const dualStore = new DualLayerStore({ projectDbPath, userGlobalDbPath });
  const projectStore = dualStore.getProjectStore();
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const idGen = opts.idGen ?? (() => {
    const ts = now().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const rand = Math.random().toString(36).slice(2, 8);
    return `pers-${ts}-${rand}`;
  });
  const recompile = async (_activeFromProject) => {
    await runCompile({
      store: dualStore,
      markdownCompiler: new MarkdownCompiler(claudeMdPath, () => now().toISOString()),
      skillCompiler: makeSkillCompiler()
    });
  };
  const before = projectStore.count();
  const fromTurnIndex = opts.fromTurnIndex;
  const filteredDetector = fromTurnIndex !== void 0 ? {
    detect: (s) => ruleBasedCorrectionDetector.detect(s).filter((m) => m.turnIndex > fromTurnIndex)
  } : ruleBasedCorrectionDetector;
  const result = await runExtractPipeline(session, {
    detector: filteredDetector,
    extractor: llmBasedKnowledgeExtractor,
    callLLM: (prompt) => llm.complete(prompt),
    store: projectStore,
    recompile,
    scope: { level: "personal" },
    source: "accumulated",
    now,
    idGen,
    validator: defaultValidator,
    projectStack: [],
    isMomentSeen: opts.isMomentSeen,
    markMomentSeen: opts.markMomentSeen
  });
  const after = projectStore.count();
  let calibrationSummary = "";
  if (!opts.skipCalibrate) {
    try {
      const eventLog = new SqliteEventLog(openDb(eventsDbPath));
      const events = eventLog.readAll();
      for (const [label, store] of [
        ["personal", dualStore.getProjectStore()],
        ["global", dualStore.getGlobalStore()]
      ]) {
        const calResult = await runCalibrationPipeline({
          calibrator: defaultCalibrator,
          store,
          events,
          now
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
              schema_version: 1
            });
          } catch {
          }
        }
        if (calResult.adjusted.length > 0) {
          calibrationSummary += `  ${label}: \u8C03\u6574 ${calResult.adjusted.length} \u6761` + (calResult.archivedNew.length > 0 ? `\uFF0C\u5F52\u6863 ${calResult.archivedNew.length} \u6761` : "") + "\n";
        }
      }
      eventLog.close();
      if (calibrationSummary) {
        await recompile([]);
      }
    } catch (err) {
      calibrationSummary = `  \u26A0 \u6821\u51C6\u9636\u6BB5\u5931\u8D25: ${String(err).slice(0, 120)}
`;
    }
  }
  dualStore.close();
  if (result.extracted.length > 0) {
    try {
      await vectorizeExtractedEntries(result.extracted, projectDbPath, opts.embedder);
    } catch {
    }
  }
  const lines = [];
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  lines.push(`  --commit \u5B8C\u6210`);
  lines.push(`  \u8BC6\u522B\u7EA0\u6B63: ${result.correctionsFound}`);
  lines.push(`  \u6210\u529F\u63D0\u53D6: ${result.extracted.length}  (\u8DF3\u8FC7 ${result.skipped}, \u5931\u8D25 ${result.failed})`);
  lines.push(`  \u77E5\u8BC6\u5E93: ${before} \u2192 ${after}`);
  lines.push(`  CLAUDE.md \u5DF2\u91CD\u7F16\u8BD1: ${claudeMdPath}`);
  if (result.extracted.length > 0) {
    lines.push("");
    lines.push("  \u65B0\u589E\u6761\u76EE:");
    for (const e of result.extracted) {
      lines.push(
        `    - [${e.category}/${e.tags[0] ?? "untagged"}] ${e.trigger} \u2192 ${e.correct_pattern}`
      );
    }
  }
  if (calibrationSummary) {
    lines.push("");
    lines.push("  \u6821\u51C6:");
    lines.push(calibrationSummary.trimEnd());
  }
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  return {
    output: lines.join("\n") + "\n",
    meta: {
      correctionsFound: result.correctionsFound,
      extracted: result.extracted.length,
      skipped: result.skipped,
      failed: result.failed,
      rejected: result.rejected.length,
      deduped: result.deduped,
      newEntries: result.extracted.map((e) => ({
        trigger: e.trigger,
        correct_pattern: e.correct_pattern,
        confidence: e.confidence
      }))
    }
  };
}
function renderReport(session, corrections, successes, sourceDesc, verbose, committing) {
  const lines = [];
  lines.push(
    committing ? "\u{1F4CA} TeamAgent Session Analyze (--commit \u6A21\u5F0F)" : "\u{1F4CA} TeamAgent Session Analyze (dry-run\uFF0C\u4E0D\u5199\u77E5\u8BC6\u5E93)"
  );
  lines.push("");
  lines.push(`\u6E90: ${sourceDesc}`);
  lines.push(`\u4F1A\u8BDD id: ${session.sessionId}`);
  lines.push(`\u56DE\u5408\u6570: ${session.turns.length}`);
  lines.push("");
  lines.push(`\u25B8 \u8BC6\u522B\u5230\u7EA0\u6B63\u65F6\u523B: ${corrections.length}`);
  const byCSig = {};
  for (const c of corrections) byCSig[c.signal] = (byCSig[c.signal] ?? 0) + 1;
  for (const [s, n] of Object.entries(byCSig)) {
    lines.push(`    - ${s}: ${n}`);
  }
  lines.push("");
  lines.push(`\u25B8 \u8BC6\u522B\u5230\u6210\u529F\u4FE1\u53F7: ${successes.length}`);
  const bySSig = {};
  for (const s of successes) bySSig[s.signal] = (bySSig[s.signal] ?? 0) + 1;
  for (const [s, n] of Object.entries(bySSig)) {
    lines.push(`    - ${s}: ${n}`);
  }
  lines.push("");
  if (verbose || corrections.length + successes.length <= 10) {
    if (corrections.length > 0) {
      lines.push("--- \u7EA0\u6B63\u65F6\u523B\u660E\u7EC6 ---");
      for (const c of corrections) {
        lines.push(
          `  [turn ${c.turnIndex}] ${c.signal} (w=${c.weight.toFixed(2)})`
        );
        lines.push(`    \u7528\u6237: ${truncate(c.correctionText, 80)}`);
        if (c.previousAssistantText) {
          lines.push(`    AI\u4E0A\u4E00\u53E5: ${truncate(c.previousAssistantText, 80)}`);
        }
      }
      lines.push("");
    }
    if (successes.length > 0) {
      lines.push("--- \u6210\u529F\u4FE1\u53F7\u660E\u7EC6 ---");
      for (const s of successes) {
        lines.push(
          `  [turn ${s.turnIndex}] ${s.signal} (w=${s.weight.toFixed(2)})`
        );
        lines.push(`    AI: ${truncate(s.assistantText, 80)}`);
      }
      lines.push("");
    }
  }
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  if (committing) {
    lines.push("  dry-run \u5B8C\u6210\uFF1B\u4E0B\u9762\u5F00\u59CB --commit \u5199\u5165\u2026");
  } else {
    lines.push("  dry-run \u5B8C\u6210\uFF0C\u672A\u5199\u5165\u77E5\u8BC6\u5E93\u3002\u52A0 --commit \u89E6\u53D1\u63D0\u53D6+\u843D\u76D8\u3002");
  }
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  return lines.join("\n") + "\n";
}
async function vectorizeExtractedEntries(entries, projectDbPath, embedder) {
  const { buildSemanticDescriptions } = await import("./src-LHF7BBP2.js");
  const actualEmbedder = embedder ?? new XenovaRuleEmbedder();
  const vdb = openDb(projectDbPath);
  try {
    for (const entry of entries) {
      const e = entry;
      const desc = e.trigger_description?.trim() && e.pattern_description?.trim() ? { trigger_description: e.trigger_description, pattern_description: e.pattern_description } : buildSemanticDescriptions({
        trigger: entry.trigger,
        wrong_pattern: entry.wrong_pattern,
        correct_pattern: entry.correct_pattern,
        reasoning: entry.reasoning
      });
      const [tv, pv] = await actualEmbedder.embed([desc.trigger_description, desc.pattern_description]);
      if (tv && pv) {
        vdb.prepare(
          "UPDATE knowledge SET trigger_description=?, pattern_description=?, embedder_model_id=? WHERE id=?"
        ).run(desc.trigger_description, desc.pattern_description, "Xenova/multilingual-e5-small", entry.id);
        syncRuleVectors(vdb, entry.id, new Float32Array(tv), new Float32Array(pv));
      }
    }
  } finally {
    vdb.close();
  }
}
function truncate(s, max) {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "\u2026";
}
function parseAnalyzeArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
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

// ../cli/src/commands/review.ts
init_esm_shims();
import os5 from "os";
import path5 from "path";
import fs4 from "fs";
function executeReview(opts = {}) {
  const home = opts.homeDir ?? os5.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const projectDbPath = opts.projectDbPath ?? path5.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath = opts.userGlobalDbPath ?? path5.join(home, ".teamagent", "global.db");
  const rows = [];
  try {
    fs4.mkdirSync(path5.dirname(projectDbPath), { recursive: true });
    fs4.mkdirSync(path5.dirname(userGlobalDbPath), { recursive: true });
    const store = new DualLayerStore({ projectDbPath, userGlobalDbPath });
    const all = store.getAll();
    store.close();
    for (const entry of all) {
      const level = entry.scope.level;
      if (opts.scope) {
        const effectiveScope = opts.scope === "team" ? "personal" : opts.scope;
        if (level !== effectiveScope) continue;
      }
      rows.push({ entry, scope: level });
    }
  } catch {
  }
  rows.sort(
    (a, b) => (b.entry.created_at ?? "").localeCompare(a.entry.created_at ?? "")
  );
  const limit = opts.limit ?? 10;
  const slice = rows.slice(0, limit);
  const lines = [];
  lines.push("\u{1F4D6} TeamAgent Review \u2014 \u6700\u8FD1\u5F55\u5165\u7684\u77E5\u8BC6\u6761\u76EE");
  lines.push("");
  lines.push(`\u5171 ${rows.length} \u6761\uFF0C\u5C55\u793A\u6700\u8FD1 ${slice.length}`);
  lines.push("");
  if (rows.length === 0) {
    lines.push("(\u77E5\u8BC6\u5E93\u4E3A\u7A7A)");
    lines.push("");
    return lines.join("\n");
  }
  if (slice.length === 0) {
    return lines.join("\n");
  }
  for (const { entry, scope } of slice) {
    const date = entry.created_at ? entry.created_at.slice(0, 10) : "????-??-??";
    const tag = entry.tags[0] ?? "untagged";
    lines.push(
      `[${date}] ${scope}/${entry.category}/${tag}  conf=${entry.confidence.toFixed(2)} ${entry.enforcement}`
    );
    lines.push(`  trigger:  ${entry.trigger}`);
    if (entry.wrong_pattern) {
      lines.push(`  wrong:    ${entry.wrong_pattern}`);
    }
    lines.push(`  correct:  ${entry.correct_pattern}`);
    lines.push(`  reason:   ${entry.reasoning}`);
    lines.push(`  id:       ${entry.id}`);
    lines.push("");
  }
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  lines.push("  \u60F3\u8C03\u6574\uFF1F\u7528 teamagent pitfall \u6216\u76F4\u63A5\u7F16\u8F91 .teamagent/knowledge.db");
  lines.push("  \u6539\u5B8C teamagent stats \u9A8C\u8BC1\uFF0C\u518D\u5F00\u65B0 Claude Code \u4F1A\u8BDD\u751F\u6548\u3002");
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  return lines.join("\n") + "\n";
}
function parseReviewArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) {
      opts.limit = parseInt(argv[i + 1], 10);
      i++;
    } else if (a.startsWith("--limit=")) {
      opts.limit = parseInt(a.slice("--limit=".length), 10);
    } else if (a === "--scope" && argv[i + 1]) {
      const v = argv[i + 1];
      if (v === "personal" || v === "team" || v === "global") opts.scope = v;
      i++;
    } else if (a.startsWith("--scope=")) {
      const v = a.slice("--scope=".length);
      if (v === "personal" || v === "team" || v === "global") opts.scope = v;
    } else if (/^-?\d+$/.test(a)) {
      const v = parseInt(a, 10);
      if (v < 0) {
        throw new Error(`review N \u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF0C\u6536\u5230: ${a}`);
      }
      opts.limit = v;
    }
  }
  return opts;
}

// ../cli/src/commands/uninstall.ts
init_esm_shims();
import fs5 from "fs";
import path6 from "path";
import os6 from "os";
var BLOCK_START_RE = /<!--\s*TEAMAGENT:START[^>]*-->/;
var BLOCK_END_RE = /<!--\s*TEAMAGENT:END[^>]*-->/;
function disable(opts = {}) {
  return uninstallHook(opts);
}
function enable(opts = {}) {
  return installHook(opts);
}
function uninstall(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.homeDir ?? os6.homedir();
  const dryRun = opts.dryRun ?? false;
  const actions = [];
  const settingsPath = path6.join(cwd, ".claude", "settings.local.json");
  if (fs5.existsSync(settingsPath)) {
    if (dryRun) {
      actions.push(`(dry-run) \u4F1A\u4ECE ${settingsPath} \u79FB\u9664 TeamAgent hook`);
    } else {
      try {
        const r = uninstallHook({ cwd });
        actions.push(
          r.removed ? `\u5DF2\u79FB\u9664 hook \u6CE8\u518C: ${r.settingsPath}` : `hook \u6CE8\u518C\u672A\u53D1\u73B0\uFF08\u5DF2\u65E0\uFF09\uFF0C\u8DF3\u8FC7: ${r.settingsPath}`
        );
      } catch (err) {
        actions.push(`\u26A0 \u79FB\u9664 hook \u5931\u8D25: ${String(err).slice(0, 160)}`);
      }
    }
  } else {
    actions.push(`\u65E0 .claude/settings.local.json\uFF0C\u8DF3\u8FC7 hook \u5378\u8F7D`);
  }
  const claudeMd = path6.join(cwd, "CLAUDE.md");
  if (fs5.existsSync(claudeMd)) {
    if (dryRun) {
      actions.push(`(dry-run) \u4F1A\u4ECE ${claudeMd} \u79FB\u9664 TEAMAGENT \u533A\u5757`);
    } else {
      try {
        const stripped = stripTeamagentBlock(
          fs5.readFileSync(claudeMd, "utf-8")
        );
        if (stripped.changed) {
          if (stripped.content.trim().length === 0) {
            fs5.unlinkSync(claudeMd);
            actions.push(`\u5DF2\u4ECE CLAUDE.md \u79FB\u9664 TEAMAGENT \u533A\u5757\uFF08\u5269\u4F59\u7A7A\u767D\uFF0C\u5DF2\u5220\u9664\u7A7A\u6587\u4EF6\uFF09`);
          } else {
            fs5.writeFileSync(claudeMd, stripped.content, "utf-8");
            actions.push(`\u5DF2\u4ECE CLAUDE.md \u79FB\u9664 TEAMAGENT \u533A\u5757`);
          }
        } else {
          actions.push(`CLAUDE.md \u65E0 TEAMAGENT \u533A\u5757\uFF0C\u8DF3\u8FC7`);
        }
      } catch (err) {
        actions.push(`\u26A0 \u5904\u7406 CLAUDE.md \u5931\u8D25: ${String(err).slice(0, 160)}`);
      }
    }
  } else {
    actions.push(`\u65E0 CLAUDE.md\uFF0C\u8DF3\u8FC7\u533A\u5757\u6E05\u7406`);
  }
  if (opts.deleteData) {
    const dirs = [
      path6.join(home, ".teamagent"),
      path6.join(cwd, ".teamagent")
    ];
    for (const d of dirs) {
      if (!fs5.existsSync(d)) {
        actions.push(`\u6570\u636E\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8DF3\u8FC7: ${d}`);
        continue;
      }
      if (dryRun) {
        actions.push(`(dry-run) \u4F1A\u5220\u9664 ${d}`);
      } else {
        try {
          fs5.rmSync(d, { recursive: true, force: true });
          actions.push(`\u5DF2\u5220\u9664: ${d}`);
        } catch (err) {
          actions.push(`\u26A0 \u5220\u9664\u5931\u8D25 ${d}: ${String(err).slice(0, 160)}`);
        }
      }
    }
  } else {
    actions.push(
      "\u4FDD\u7559\u77E5\u8BC6\u6570\u636E\uFF08~/.teamagent \u548C ./.teamagent\uFF09\u3002\u52A0 --delete-data \u540C\u65F6\u6E05\u7406"
    );
  }
  return { dryRun, actions };
}
function stripTeamagentBlock(content) {
  const startMatch = content.match(BLOCK_START_RE);
  if (!startMatch) return { content, changed: false };
  const startIdx = startMatch.index;
  const afterStart = content.slice(startIdx + startMatch[0].length);
  const endMatch = afterStart.match(BLOCK_END_RE);
  if (!endMatch) return { content, changed: false };
  const endOfBlock = startIdx + startMatch[0].length + endMatch.index + endMatch[0].length;
  const before = content.slice(0, startIdx).replace(/\s+$/, "");
  const after = content.slice(endOfBlock).replace(/^\s+/, "");
  const glue = before && after ? "\n\n" : "";
  const joined = before + glue + after;
  return { content: joined.endsWith("\n") ? joined : joined + "\n", changed: true };
}
function parseUninstallArgs(argv) {
  const opts = {};
  for (const a of argv) {
    if (a === "--delete-data") opts.deleteData = true;
    else if (a === "--dry-run") opts.dryRun = true;
  }
  return opts;
}
function renderUninstallResult(r) {
  const lines = [];
  lines.push(r.dryRun ? "\u{1F50D} TeamAgent Uninstall (dry-run)" : "\u{1F5D1}\uFE0F  TeamAgent Uninstall");
  lines.push("");
  for (const a of r.actions) lines.push(`  ${a}`);
  lines.push("");
  return lines.join("\n") + "\n";
}

// ../cli/src/commands/calibrate.ts
init_esm_shims();
import os7 from "os";
import path7 from "path";
import fs6 from "fs";
function resolvePaths2(opts) {
  const home = opts.homeDir ?? os7.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    projectDbPath: opts.projectDbPath ?? path7.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath: opts.userGlobalDbPath ?? path7.join(home, ".teamagent", "global.db"),
    eventsDbPath: opts.eventsDbPath ?? path7.join(home, ".teamagent", "events.db"),
    claudeMdPath: opts.claudeMdPath ?? path7.join(cwd, "CLAUDE.md")
  };
}
function synthesizeObservations(events) {
  return events.filter((e) => e.kind === "hook-post.result" && e.knowledge_id).map((e) => ({
    id: `obs-${e.id}`,
    knowledge_id: e.knowledge_id,
    timestamp: e.timestamp,
    // B-055: use !== true so null/undefined/0 payload.success is treated as "failure"
    // (conservative; aligns with the closed-world assumption: unknown = not confirmed success)
    outcome: e.payload?.success !== true ? "failure" : "success",
    source_event: e.id,
    tool_use_id: e.tool_use_id
  }));
}
function filterEventsByDays(events, days, now) {
  if (!days || days <= 0) return events;
  const cutoff = now.getTime() - days * 24 * 3600 * 1e3;
  return events.filter((e) => {
    try {
      return new Date(e.timestamp).getTime() >= cutoff;
    } catch {
      return true;
    }
  });
}
function makeEventId(now) {
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `cal-${ts}-${rand}`;
}
function recordAdjustment(log, adj, now) {
  log.append({
    id: makeEventId(now),
    kind: "calibrator.adjusted",
    knowledge_id: adj.knowledge_id,
    confidence_before: adj.before,
    confidence_after: adj.after,
    status_after: adj.status_after,
    timestamp: now.toISOString(),
    schema_version: 1
  });
}
function makeReadOnlyStore(real) {
  const proxy = Object.create(real);
  proxy.update = () => {
  };
  return proxy;
}
async function executeCalibrate(opts = {}) {
  const paths = resolvePaths2(opts);
  const dryRun = opts.dryRun ?? false;
  const legacy = opts.legacy ?? false;
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const nowDate = now();
  fs6.mkdirSync(path7.dirname(paths.projectDbPath), { recursive: true });
  fs6.mkdirSync(path7.dirname(paths.userGlobalDbPath), { recursive: true });
  fs6.mkdirSync(path7.dirname(paths.eventsDbPath), { recursive: true });
  let events = [];
  let eventLog = null;
  try {
    if (fs6.existsSync(paths.eventsDbPath)) {
      eventLog = new SqliteEventLog(openDb(paths.eventsDbPath));
      events = eventLog.readAll();
    }
  } catch {
  }
  events = filterEventsByDays(events, opts.days, nowDate);
  const dualStore = new DualLayerStore({
    projectDbPath: paths.projectDbPath,
    userGlobalDbPath: paths.userGlobalDbPath
  });
  const scopes = [
    { scope: "personal", label: "personal", store: dualStore.getProjectStore(), storePath: paths.projectDbPath },
    { scope: "global", label: "global", store: dualStore.getGlobalStore(), storePath: paths.userGlobalDbPath }
  ];
  const byScope = [];
  let totalAdjusted = 0;
  let totalArchived = 0;
  if (legacy) {
    for (const { label, store, storePath } of scopes) {
      if (store.count() === 0 && !fs6.existsSync(storePath)) {
        byScope.push({
          scope: label,
          storePath,
          scanned: 0,
          adjustedCount: 0,
          archivedCount: 0,
          adjustments: []
        });
        continue;
      }
      if (dryRun) {
        const fakeStore = makeReadOnlyStore(store);
        const pred = await runCalibrationPipeline({
          calibrator: defaultCalibrator,
          store: fakeStore,
          events,
          now
        });
        byScope.push({
          scope: label,
          storePath,
          scanned: pred.scanned,
          adjustedCount: pred.adjusted.length,
          archivedCount: pred.archivedNew.length,
          adjustments: pred.adjusted
        });
        totalAdjusted += pred.adjusted.length;
        totalArchived += pred.archivedNew.length;
        continue;
      }
      const result = await runCalibrationPipeline({
        calibrator: defaultCalibrator,
        store,
        events,
        now
      });
      if (result.adjusted.length > 0) {
        if (!eventLog) {
          eventLog = new SqliteEventLog(openDb(paths.eventsDbPath));
        }
        for (const adj of result.adjusted) {
          try {
            recordAdjustment(eventLog, adj, nowDate);
          } catch {
          }
        }
      }
      byScope.push({
        scope: label,
        storePath,
        scanned: result.scanned,
        adjustedCount: result.adjusted.length,
        archivedCount: result.archivedNew.length,
        adjustments: result.adjusted
      });
      totalAdjusted += result.adjusted.length;
      totalArchived += result.archivedNew.length;
    }
  } else {
    for (const { label, store, storePath } of scopes) {
      if (store.count() === 0 && !fs6.existsSync(storePath)) {
        byScope.push({
          scope: label,
          storePath,
          scanned: 0,
          adjustedCount: 0,
          archivedCount: 0,
          adjustments: [],
          v2Adjustments: []
        });
        continue;
      }
      const observations = synthesizeObservations(events);
      const v2Result = await runCalibrationPipelineV2({
        calibrator: v2Calibrator,
        store,
        events,
        observations,
        now,
        dryRun
      });
      byScope.push({
        scope: label,
        storePath,
        scanned: v2Result.scanned,
        adjustedCount: v2Result.adjusted.length,
        archivedCount: v2Result.dormantNew.length,
        adjustments: [],
        v2Adjustments: v2Result.adjusted
      });
      totalAdjusted += v2Result.adjusted.length;
      totalArchived += v2Result.dormantNew.length;
    }
  }
  if (!dryRun && totalAdjusted > 0) {
    try {
      await runCompile({
        store: dualStore,
        markdownCompiler: new MarkdownCompiler(paths.claudeMdPath, () => nowDate.toISOString()),
        skillCompiler: makeSkillCompiler()
      });
    } catch {
    }
  }
  dualStore.close();
  eventLog?.close();
  return { dryRun, byScope, totalAdjusted, totalArchived };
}
function parseCalibrateArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--legacy") opts.legacy = true;
    else if (a === "--days" && argv[i + 1]) {
      opts.days = parseInt(argv[i + 1], 10);
      i++;
    } else if (a.startsWith("--days=")) {
      opts.days = parseInt(a.slice("--days=".length), 10);
    }
  }
  return opts;
}
function renderCalibrateResult(r) {
  const lines = [];
  lines.push(r.dryRun ? "\u{1F50D} TeamAgent Calibrate (dry-run)" : "\u2696\uFE0F  TeamAgent Calibrate");
  lines.push("");
  for (const { scope, scanned, adjustedCount, archivedCount, adjustments, v2Adjustments } of r.byScope) {
    if (scanned === 0) {
      lines.push(`  ${scope.padEnd(8)} \u65E0 store / \u8DF3\u8FC7`);
      continue;
    }
    if (adjustedCount === 0) {
      lines.push(`  ${scope.padEnd(8)} \u626B\u63CF ${scanned}, \u65E0\u53D8\u5316`);
      continue;
    }
    lines.push(
      `  ${scope.padEnd(8)} \u626B\u63CF ${scanned}, \u8C03\u6574 ${adjustedCount}` + (archivedCount > 0 ? ` (\u542B\u5F52\u6863 ${archivedCount})` : "")
    );
    if (v2Adjustments && v2Adjustments.length > 0) {
      for (const adj of v2Adjustments.slice(0, 5)) {
        const tierPart = adj.tier_transition ? ` [${adj.tier_before} \u2192 ${adj.tier_after}]` : adj.tier_after !== adj.tier_before ? ` [${adj.tier_before} \u2192 ${adj.tier_after}]` : "";
        const demPart = Math.abs(adj.demerit_after - adj.demerit_before) > 1e-6 ? ` demerit ${adj.demerit_before.toFixed(0)} \u2192 ${adj.demerit_after.toFixed(0)}` : "";
        const confDelta = adj.confidence_after - adj.confidence_before;
        lines.push(
          `    - ${adj.knowledge_id}: conf ${adj.confidence_before.toFixed(2)} \u2192 ${adj.confidence_after.toFixed(2)} (${confDelta > 0 ? "+" : ""}${confDelta.toFixed(2)})${demPart}${tierPart}`
        );
      }
      if (v2Adjustments.length > 5) {
        lines.push(`    ... (${v2Adjustments.length - 5} more)`);
      }
    } else {
      for (const adj of adjustments.slice(0, 5)) {
        const arrow = adj.status_after !== adj.status_before ? ` \u2192 ${adj.status_after}` : "";
        lines.push(
          `    - ${adj.knowledge_id}: ${adj.before.toFixed(2)} \u2192 ${adj.after.toFixed(2)} (${adj.delta > 0 ? "+" : ""}${adj.delta.toFixed(2)})${arrow}`
        );
      }
      if (adjustments.length > 5) {
        lines.push(`    ... (${adjustments.length - 5} more)`);
      }
    }
  }
  lines.push("");
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  lines.push(
    `  \u603B\u8BA1: ${r.totalAdjusted} \u6761\u8C03\u6574${r.totalArchived > 0 ? `, ${r.totalArchived} \u6761\u5F52\u6863` : ""}`
  );
  if (r.dryRun) {
    lines.push("  (dry-run\uFF0C\u672A\u5199\u5165)");
  }
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  return lines.join("\n") + "\n";
}

// ../cli/src/commands/verify.ts
init_esm_shims();
import path8 from "path";
import fs7 from "fs";

// ../../fixtures/scenarios/index.ts
init_esm_shims();

// ../../fixtures/scenarios/python-version.ts
init_esm_shims();
var pythonVersionScenario = {
  id: "python-version",
  description: "AI \u5199 'python script.py' \u88AB\u7EA0\u6B63\u7528 python3\uFF0C\u7CFB\u7EDF\u5B66\u5230\uFF0C\u4E0B\u6B21\u62E6\u622A",
  meta: {
    category: "code"
  },
  phaseA: {
    session: {
      sessionId: "scenario-python-version",
      startTime: "2026-04-15T00:00:00Z",
      endTime: "2026-04-15T00:10:00Z",
      turns: [
        {
          turnIndex: 0,
          userMessage: "\u8DD1\u4E00\u4E0B python script.py",
          assistantText: "\u597D\uFF0C\u6211\u7528 python script.py \u6765\u8DD1",
          toolCalls: [
            {
              id: "tool-1",
              name: "Bash",
              input: { command: "python script.py" },
              succeeded: false,
              result: "command not found: python"
            }
          ],
          timestamp: "2026-04-15T00:01:00Z"
        },
        {
          turnIndex: 1,
          userMessage: "\u4E0D\u5BF9\uFF0C\u672C\u673A\u7684 python \u662F python3\uFF0C\u8981\u7528 python3 \u547D\u4EE4",
          assistantText: "\u597D\uFF0C\u6539\u7528 python3",
          toolCalls: [
            {
              id: "tool-2",
              name: "Bash",
              input: { command: "python3 script.py" },
              succeeded: true
            }
          ],
          timestamp: "2026-04-15T00:02:00Z"
        }
      ]
    },
    expectedCorrections: [{ signal: "explicit_denial", minWeight: 0.9, turnIndex: 1 }]
  },
  phaseB: {
    mockLLMResponse: JSON.stringify({
      category: "C",
      tags: ["python", "command"],
      type: "avoidance",
      nature: "objective",
      trigger: "\u5728\u672C\u673A\u6267\u884C Python \u811A\u672C",
      wrong_pattern: "python ",
      correct_pattern: "python3",
      reasoning: "\u672C\u673A\u7684 python \u522B\u540D\u6307\u5411 python3\uFF1B\u76F4\u63A5\u7528 python \u4F1A\u627E\u4E0D\u5230\u547D\u4EE4"
    }),
    expectedRule: {
      categoryEquals: "C",
      typeEquals: "avoidance",
      natureEquals: "objective",
      wrongPatternContains: "python",
      correctPatternContains: "python3"
    }
  },
  phaseC: {
    toolCall: {
      toolName: "Bash",
      input: { command: "python script.py" }
    },
    expectedBehavior: "block"
    // confidence=0.95 (signal weight) + objective → block
  }
};

// ../../fixtures/scenarios/tech-choice.ts
init_esm_shims();
var techChoiceScenario = {
  id: "tech-choice",
  description: "AI \u63A8\u8350 Redux\uFF0C\u7528\u6237\u504F\u597D Zustand\uFF1B\u7CFB\u7EDF\u5B66\u5230\uFF0C\u4E0B\u6B21 npm install Redux \u65F6\u62E6\u622A",
  meta: { category: "engineering" },
  phaseA: {
    session: {
      sessionId: "scenario-tech-choice",
      startTime: "2026-04-15T00:00:00Z",
      endTime: "2026-04-15T00:10:00Z",
      turns: [
        {
          turnIndex: 0,
          userMessage: "\u7ED9\u8FD9\u4E2A React app \u52A0\u4E00\u4E2A\u72B6\u6001\u7BA1\u7406\u5E93",
          assistantText: "\u6211\u63A8\u8350\u7528 Redux Toolkit\uFF0C\u6BD4\u8F83\u6210\u719F",
          toolCalls: [],
          timestamp: "2026-04-15T00:01:00Z"
        },
        {
          turnIndex: 1,
          userMessage: "\u4E0D\u5BF9\uFF0C\u7528 Zustand\uFF0C\u6211\u4EEC\u8981\u8F7B\u91CF",
          assistantText: "\u597D\uFF0C\u6539\u7528 Zustand",
          toolCalls: [
            { id: "t1", name: "Bash", input: { command: "pnpm add zustand" }, succeeded: true }
          ],
          timestamp: "2026-04-15T00:02:00Z"
        }
      ]
    },
    expectedCorrections: [
      { signal: "explicit_denial", minWeight: 0.9, turnIndex: 1 }
    ]
  },
  phaseB: {
    mockLLMResponse: JSON.stringify({
      category: "E",
      tags: ["state-management", "react", "tech-choice"],
      type: "avoidance",
      nature: "subjective",
      trigger: "\u524D\u7AEF\u9879\u76EE\u9700\u8981\u9009\u62E9\u72B6\u6001\u7BA1\u7406\u5E93",
      wrong_pattern: "redux|@reduxjs/toolkit",
      correct_pattern: "Zustand",
      reasoning: "\u7528\u6237\u504F\u597D\u8F7B\u91CF\u65B9\u6848\uFF1BRedux Toolkit \u6837\u677F\u4EE3\u7801\u591A\uFF0CZustand API \u6781\u7B80"
    }),
    expectedRule: {
      categoryEquals: "E",
      typeEquals: "avoidance",
      natureEquals: "subjective",
      wrongPatternContains: "redux",
      correctPatternContains: "Zustand"
    }
  },
  phaseC: {
    toolCall: {
      toolName: "Bash",
      input: { command: "npm install @reduxjs/toolkit" }
    },
    // subjective + 0.95 → warn (subjective caps at warn)
    expectedBehavior: "warn"
  }
};

// ../../fixtures/scenarios/api-hallucination.ts
init_esm_shims();
var apiHallucinationScenario = {
  id: "api-hallucination",
  description: "AI \u5199\u4E86 JS \u6570\u7EC4 .removeAt(i) (\u4E0D\u5B58\u5728)\uFF0C\u7528\u6237\u7EA0\u6B63\u7528 splice\uFF1B\u4E0B\u6B21\u62E6\u622A",
  meta: { category: "code" },
  phaseA: {
    session: {
      sessionId: "scenario-api-hallucination",
      startTime: "2026-04-15T00:00:00Z",
      endTime: "2026-04-15T00:10:00Z",
      turns: [
        {
          turnIndex: 0,
          userMessage: "\u4ECE\u8FD9\u4E2A\u6570\u7EC4\u91CC\u5220\u6389\u7B2C 3 \u4E2A\u5143\u7D20",
          assistantText: "\u597D\uFF0C\u7528 array.removeAt(3) \u5C31\u884C",
          toolCalls: [
            {
              id: "t1",
              name: "Edit",
              input: {
                file_path: "src/list.ts",
                old_string: "// remove item",
                new_string: "items.removeAt(3);"
              },
              succeeded: true
            }
          ],
          timestamp: "2026-04-15T00:01:00Z"
        },
        {
          turnIndex: 1,
          userMessage: "\u9519\u4E86\uFF0CJS \u6570\u7EC4\u6CA1\u6709 removeAt \u65B9\u6CD5\uFF0C\u7528 splice(3, 1)",
          assistantText: "\u5BF9\uFF0C\u6211\u641E\u6DF7\u4E86 .NET \u548C JS",
          toolCalls: [
            {
              id: "t2",
              name: "Edit",
              input: {
                file_path: "src/list.ts",
                old_string: "items.removeAt(3);",
                new_string: "items.splice(3, 1);"
              },
              succeeded: true
            }
          ],
          timestamp: "2026-04-15T00:02:00Z"
        }
      ]
    },
    expectedCorrections: [
      { signal: "explicit_denial", minWeight: 0.9, turnIndex: 1 }
    ]
  },
  phaseB: {
    mockLLMResponse: JSON.stringify({
      category: "C",
      tags: ["javascript", "array", "api"],
      type: "avoidance",
      nature: "objective",
      trigger: "\u9700\u8981\u4ECE JavaScript \u6570\u7EC4\u4E2D\u5220\u9664\u5143\u7D20",
      wrong_pattern: ".removeAt(",
      correct_pattern: ".splice(",
      reasoning: "JavaScript Array \u6CA1\u6709 removeAt \u65B9\u6CD5\uFF08\u8FD9\u662F .NET \u98CE\u683C\uFF09\uFF1B\u6807\u51C6\u505A\u6CD5\u662F Array.prototype.splice(index, 1)"
    }),
    expectedRule: {
      categoryEquals: "C",
      typeEquals: "avoidance",
      natureEquals: "objective",
      wrongPatternContains: "removeAt",
      correctPatternContains: "splice"
    }
  },
  phaseC: {
    toolCall: {
      toolName: "Edit",
      input: {
        file_path: "src/another.ts",
        old_string: "// here",
        new_string: "list.removeAt(0);"
      }
    },
    // objective + 0.95 → block
    expectedBehavior: "block"
  }
};

// ../../fixtures/scenarios/security.ts
init_esm_shims();
var securityScenario = {
  id: "security",
  description: "AI \u628A sk- \u5F00\u5934\u7684 API key \u786C\u7F16\u7801\u5230 .ts \u6587\u4EF6\uFF0C\u7528\u6237\u7EA0\u6B63\u7528 env var\uFF1B\u4E0B\u6B21\u62E6\u622A",
  meta: { category: "code" },
  phaseA: {
    session: {
      sessionId: "scenario-security",
      startTime: "2026-04-15T00:00:00Z",
      endTime: "2026-04-15T00:10:00Z",
      turns: [
        {
          turnIndex: 0,
          userMessage: "\u52A0\u4E0A OpenAI \u5BA2\u6237\u7AEF\u8C03\u7528",
          assistantText: "\u597D\uFF0C\u521D\u59CB\u5316 client \u7684\u65F6\u5019\u52A0 API key",
          toolCalls: [
            {
              id: "t1",
              name: "Write",
              input: {
                file_path: "src/openai-client.ts",
                content: "import OpenAI from 'openai';\nexport const client = new OpenAI({ apiKey: 'sk-proj-FAKE12345' });\n"
              },
              succeeded: true
            }
          ],
          timestamp: "2026-04-15T00:01:00Z"
        },
        {
          turnIndex: 1,
          userMessage: "\u4E0D\u5BF9\uFF0Csecret \u4E0D\u80FD\u5199\u4EE3\u7801\u91CC\uFF0C\u7528 process.env.OPENAI_API_KEY",
          assistantText: "\u5BF9\uFF0C\u6211\u5E94\u8BE5\u7528 env var",
          toolCalls: [
            {
              id: "t2",
              name: "Edit",
              input: {
                file_path: "src/openai-client.ts",
                old_string: "apiKey: 'sk-proj-FAKE12345'",
                new_string: "apiKey: process.env.OPENAI_API_KEY"
              },
              succeeded: true
            }
          ],
          timestamp: "2026-04-15T00:02:00Z"
        }
      ]
    },
    expectedCorrections: [
      { signal: "explicit_denial", minWeight: 0.9, turnIndex: 1 }
    ]
  },
  phaseB: {
    mockLLMResponse: JSON.stringify({
      category: "S",
      tags: ["security", "secret", "env-var"],
      type: "avoidance",
      nature: "objective",
      trigger: "\u5728\u6E90\u4EE3\u7801\u91CC\u914D\u7F6E\u5916\u90E8\u670D\u52A1\u7684\u8BA4\u8BC1\u5BC6\u94A5",
      wrong_pattern: `apiKey: 'sk-|apiKey: "sk-`,
      correct_pattern: "apiKey: process.env.<NAME>",
      reasoning: "\u786C\u7F16\u7801 secret \u4F1A\u8FDB git history \u6C38\u4E45\u6CC4\u6F0F\uFF1B\u5FC5\u987B\u4ECE\u73AF\u5883\u53D8\u91CF\u8BFB\u53D6"
    }),
    expectedRule: {
      categoryEquals: "S",
      typeEquals: "avoidance",
      natureEquals: "objective",
      wrongPatternContains: "sk-",
      correctPatternContains: "process.env"
    }
  },
  phaseC: {
    toolCall: {
      toolName: "Write",
      input: {
        file_path: "src/anthropic-client.ts",
        content: "import Anthropic from '@anthropic-ai/sdk';\nexport const c = new Anthropic({ apiKey: 'sk-ant-OTHER999' });\n"
      }
    },
    // objective + 0.95 → block
    expectedBehavior: "block"
  }
};

// ../../fixtures/scenarios/workflow-order.ts
init_esm_shims();
var workflowOrderScenario = {
  id: "workflow-order",
  description: "AI \u7528 'git add .' \u592A\u5BBD\uFF1B\u7528\u6237\u6559\u53EA add \u5177\u4F53\u6587\u4EF6\uFF1B\u4E0B\u6B21 warn \u63D0\u9192",
  meta: { category: "strategy" },
  phaseA: {
    session: {
      sessionId: "scenario-workflow-order",
      startTime: "2026-04-15T00:00:00Z",
      endTime: "2026-04-15T00:10:00Z",
      turns: [
        {
          turnIndex: 0,
          userMessage: "\u628A\u8FD9\u6B21\u7684\u4FEE\u6539\u63D0\u4EA4\u4E86",
          assistantText: "\u597D\uFF0Cgit add . \u7136\u540E commit",
          toolCalls: [
            { id: "t1", name: "Bash", input: { command: "git add ." }, succeeded: true }
          ],
          timestamp: "2026-04-15T00:01:00Z"
        },
        {
          turnIndex: 1,
          userMessage: "\u4E0D\u5BF9\uFF0Cgit add . \u592A\u5BBD\u5BB9\u6613\u628A .env \u8FD9\u79CD\u5E26\u8FDB\u53BB\uFF0C\u8981 add \u5177\u4F53\u6587\u4EF6",
          assistantText: "\u5BF9\uFF0C\u5E94\u8BE5\u660E\u786E",
          toolCalls: [
            {
              id: "t2",
              name: "Bash",
              input: { command: "git add src/api.ts src/utils.ts" },
              succeeded: true
            }
          ],
          timestamp: "2026-04-15T00:02:00Z"
        }
      ]
    },
    expectedCorrections: [
      { signal: "explicit_denial", minWeight: 0.9, turnIndex: 1 }
    ]
  },
  phaseB: {
    mockLLMResponse: JSON.stringify({
      category: "S",
      tags: ["git", "workflow", "safety"],
      type: "avoidance",
      nature: "subjective",
      trigger: "git \u63D0\u4EA4\u524D staging \u6587\u4EF6",
      wrong_pattern: "git add .|git add -A",
      correct_pattern: "git add <\u5177\u4F53\u6587\u4EF6>",
      reasoning: "git add . \u5BB9\u6613\u628A .env / credentials / \u5927\u6587\u4EF6\u7B49\u654F\u611F\u6216\u4E0D\u8BE5\u5165\u5E93\u7684\u5185\u5BB9\u5E26\u8FDB\u53BB\uFF1B\u660E\u786E\u52A0\u6587\u4EF6\u66F4\u5B89\u5168"
    }),
    expectedRule: {
      categoryEquals: "S",
      typeEquals: "avoidance",
      natureEquals: "subjective",
      wrongPatternContains: "git add .",
      correctPatternContains: "\u5177\u4F53\u6587\u4EF6"
    }
  },
  phaseC: {
    toolCall: {
      toolName: "Bash",
      input: { command: "git add ." }
    },
    // subjective → max enforcement = warn
    expectedBehavior: "warn"
  }
};

// ../../fixtures/scenarios/index.ts
var allScenarios = [
  pythonVersionScenario,
  techChoiceScenario,
  apiHallucinationScenario,
  securityScenario,
  workflowOrderScenario
];

// ../cli/src/commands/verify.ts
async function executeVerify(opts = {}) {
  const scenarios = opts.scenarios ?? allScenarios;
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const result = await runVerify(scenarios, {
    detector: ruleBasedCorrectionDetector,
    extractor: llmBasedKnowledgeExtractor,
    makeStore: () => new InMemoryKnowledgeStore(),
    now
  });
  let reportPath;
  if (opts.reportPath) {
    const md = renderVerifyMarkdown(result, now());
    fs7.mkdirSync(path8.dirname(opts.reportPath), { recursive: true });
    fs7.writeFileSync(opts.reportPath, md, "utf-8");
    reportPath = opts.reportPath;
  }
  return { result, reportPath };
}
function renderVerifyTerminal(r) {
  const lines = [];
  lines.push("\u{1F52C} TeamAgent Verify");
  lines.push("");
  for (const s of r.scenarios) {
    const sym = s.passed ? "\u2713" : "\u2717";
    lines.push(
      `  ${sym} ${s.scenarioId.padEnd(20)} PRR=${s.prr.toString().padStart(3)}  KP=${s.kp.toFixed(1)}`
    );
    if (!s.passed) {
      const failed = [];
      if (!s.phaseA.passed) failed.push("A");
      if (!s.phaseB.passed) failed.push("B");
      if (!s.phaseC.passed) failed.push("C");
      lines.push(
        `      Phase \u5931\u8D25: ${failed.join(", ")}  expectedBehavior=${s.phaseC.expectedBehavior} actual=${s.phaseC.actualBehavior}`
      );
      for (const e of s.errors.slice(0, 3)) lines.push(`      \u26A0 ${e.slice(0, 100)}`);
    }
  }
  lines.push("");
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  lines.push(`  \u901A\u8FC7: ${r.passed}/${r.total}`);
  lines.push(`  \u5E73\u5747 PRR: ${r.averagePRR.toFixed(1)}`);
  lines.push(`  \u5E73\u5747 KP:  ${r.averageKP.toFixed(2)}/5`);
  lines.push("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  return lines.join("\n") + "\n";
}
function renderVerifyMarkdown(r, now) {
  const lines = [];
  lines.push("# TeamAgent Verify \u62A5\u544A");
  lines.push("");
  lines.push(`> \u751F\u6210\u65F6\u95F4: ${now.toISOString()}`);
  lines.push(`> \u573A\u666F\u6570: ${r.total}`);
  lines.push("");
  lines.push("## \u603B\u89C8");
  lines.push("");
  lines.push("| \u6307\u6807 | \u503C |");
  lines.push("|------|----|");
  lines.push(`| \u901A\u8FC7\u7387 | ${r.passed}/${r.total} (${(r.passed / r.total * 100).toFixed(0)}%) |`);
  lines.push(`| \u5E73\u5747 PRR (Pitfall Reduction Rate) | ${r.averagePRR.toFixed(1)} |`);
  lines.push(`| \u5E73\u5747 KP (Knowledge Precision, 1-5) | ${r.averageKP.toFixed(2)} |`);
  lines.push("");
  lines.push("## \u6BCF\u4E2A\u573A\u666F\u660E\u7EC6");
  lines.push("");
  for (const s of r.scenarios) {
    lines.push(`### ${s.scenarioId} ${s.passed ? "\u2713" : "\u2717"}`);
    lines.push("");
    lines.push(`- PRR: ${s.prr}`);
    lines.push(`- KP: ${s.kp.toFixed(2)}`);
    lines.push("");
    lines.push("**Phase A (\u8E29\u5751)**:");
    lines.push("");
    lines.push(`- detector \u8C03\u7528: ${s.phaseA.detectorCalled ? "\u2713" : "\u2717"}`);
    lines.push(`- \u8BC6\u522B\u5230\u7EA0\u6B63: ${s.phaseA.correctionsFound} \u6761`);
    for (const m of s.phaseA.expectedMatches) {
      lines.push(`  - ${m.signal}: ${m.matched ? "\u2713" : "\u2717"}`);
    }
    lines.push("");
    lines.push("**Phase B (\u5B66\u4E60)**:");
    lines.push("");
    lines.push(`- \u89C4\u5219\u751F\u6210: ${s.phaseB.ruleGenerated ? "\u2713" : "\u2717"}`);
    if (s.phaseB.rulePredicates.length > 0) {
      for (const p of s.phaseB.rulePredicates) {
        lines.push(`  - ${p.predicate}: ${p.passed ? "\u2713" : "\u2717"}`);
      }
    }
    lines.push("");
    lines.push("**Phase C (\u907F\u5751)**:");
    lines.push("");
    lines.push(`- \u671F\u671B\u884C\u4E3A: ${s.phaseC.expectedBehavior}`);
    lines.push(`- \u5B9E\u9645\u884C\u4E3A: ${s.phaseC.actualBehavior}`);
    lines.push(`- \u901A\u8FC7: ${s.phaseC.passed ? "\u2713" : "\u2717"}`);
    lines.push("");
    if (s.errors.length > 0) {
      lines.push("**\u9519\u8BEF**:");
      lines.push("");
      for (const e of s.errors) lines.push(`- ${e}`);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
  lines.push("## \u5173\u4E8E\u8FD9\u4EFD\u62A5\u544A");
  lines.push("");
  lines.push(
    "5 \u4E2A\u573A\u666F\u6D4B\u8BD5\u7CFB\u7EDF\u80FD\u5426\u5B8C\u6210\u5B8C\u6574\u95ED\u73AF\uFF08**\u8E29\u5751\u8BC6\u522B \u2192 \u77E5\u8BC6\u63D0\u53D6 \u2192 \u540E\u7EED\u62E6\u622A**\uFF09\u3002"
  );
  lines.push(
    "Phase B \u7528 mock LLM \u6CE8\u5165\u786E\u5B9A\u54CD\u5E94\u2014\u2014\u5B9E\u9645\u90E8\u7F72\u65F6\u662F\u771F `claude -p`\uFF0C\u8F93\u51FA\u4F1A\u6709\u6296\u52A8\u4F46 shape \u4E00\u81F4\u3002"
  );
  lines.push("");
  lines.push(
    "PRR=100% \u8868\u793A\u89C4\u5219\u6210\u529F\u5728 Phase C \u62E6\u4F4F\u4E86\u76F8\u4F3C\u9519\u8BEF\uFF1BKP=5/5 \u8868\u793A\u63D0\u53D6\u7684\u89C4\u5219\u5B57\u6BB5\u5168\u90E8\u7B26\u5408\u9884\u671F\u3002"
  );
  return lines.join("\n") + "\n";
}
function parseVerifyArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report" && argv[i + 1]) {
      opts.reportPath = argv[i + 1];
      i++;
    } else if (a.startsWith("--report=")) {
      opts.reportPath = a.slice("--report=".length);
    }
  }
  return opts;
}

// ../cli/src/commands/e2e-evaluate.ts
init_esm_shims();
import fs8 from "fs";
import os8 from "os";
import path9 from "path";
var CASES = [
  {
    id: "http-client",
    userRequest: "Please add a function that fetches user data.",
    assistantText: "I will use axios for the HTTP request.",
    toolName: "Write",
    toolInput: {
      file_path: "src/api.ts",
      content: `import axios from "axios";
export async function getUser(id: string) { return (await axios.get("/api/users/" + id)).data; }
`
    },
    correctionText: "Wrong, this project uses fetch instead of axios.",
    expectedWrong: "axios",
    expectedCorrect: "fetch",
    llm: {
      category: "E",
      tags: ["http-client"],
      type: "avoidance",
      nature: "objective",
      trigger: "When adding HTTP client code",
      wrong_pattern: "axios|Axios",
      correct_pattern: "Use built-in fetch.",
      reasoning: "The project standard avoids an extra HTTP dependency."
    },
    probes: [
      {
        id: "axios-bash-install",
        kind: "positive",
        tool_name: "Bash",
        tool_input: { command: "npm install axios" }
      },
      {
        id: "axios-import-write",
        kind: "generalization",
        tool_name: "Write",
        tool_input: {
          file_path: "src/other.ts",
          content: `import client from "axios";
export const get = client.get;
`
        }
      },
      {
        id: "axios-doc-mention",
        kind: "negative",
        tool_name: "Write",
        tool_input: {
          file_path: "docs/history.md",
          content: "Legacy docs mention axios as historical context."
        }
      }
    ]
  },
  {
    id: "date-library",
    userRequest: "Please add date formatting.",
    assistantText: "I will use moment for date formatting.",
    toolName: "Write",
    toolInput: {
      file_path: "src/date.ts",
      content: `import moment from "moment";
export const fmt = (d: Date) => moment(d).format("YYYY-MM-DD");
`
    },
    correctionText: "Wrong, use dayjs instead of moment.",
    expectedWrong: "moment",
    expectedCorrect: "dayjs",
    llm: {
      category: "E",
      tags: ["date-library"],
      type: "avoidance",
      nature: "objective",
      trigger: "When adding date formatting dependencies",
      wrong_pattern: "moment",
      correct_pattern: "Use dayjs.",
      reasoning: "The project standardizes on dayjs."
    },
    probes: [
      {
        id: "moment-install",
        kind: "positive",
        tool_name: "Bash",
        tool_input: { command: "pnpm add moment" }
      },
      {
        id: "moment-import-write",
        kind: "generalization",
        tool_name: "Write",
        tool_input: {
          file_path: "src/date2.ts",
          content: `import moment from "moment";
export const y = moment().year();
`
        }
      },
      {
        id: "momentum-substring",
        kind: "negative",
        tool_name: "Bash",
        tool_input: { command: "echo momentum is not a date library" }
      },
      {
        id: "moment-comment",
        kind: "negative",
        tool_name: "Write",
        tool_input: {
          file_path: "src/date3.ts",
          content: `// moment was used before migration
export const fmt = (d: Date) => d.toISOString();
`
        }
      }
    ]
  },
  {
    id: "state-library",
    userRequest: "Please add global UI state.",
    assistantText: "I will install Redux Toolkit and wire the store.",
    toolName: "Bash",
    toolInput: { command: "pnpm add @reduxjs/toolkit react-redux" },
    correctionText: "Wrong, use Zustand here instead of Redux.",
    expectedWrong: "redux",
    expectedCorrect: "zustand",
    llm: {
      category: "E",
      tags: ["state-library"],
      type: "avoidance",
      nature: "objective",
      trigger: "When adding client state management",
      wrong_pattern: "@reduxjs/toolkit|react-redux|redux",
      correct_pattern: "Use Zustand.",
      reasoning: "The app standardizes on Zustand for small client stores."
    },
    probes: [
      {
        id: "redux-install",
        kind: "positive",
        tool_name: "Bash",
        tool_input: { command: "pnpm add @reduxjs/toolkit react-redux" }
      },
      {
        id: "redux-generalized",
        kind: "generalization",
        tool_name: "Bash",
        tool_input: { command: "npm install redux" }
      },
      {
        id: "reducer-word",
        kind: "negative",
        tool_name: "Write",
        tool_input: {
          file_path: "src/reducer.ts",
          content: "export function reducer(state: number) { return state + 1; }\n"
        }
      }
    ]
  }
];
function parseE2EEvaluateArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") opts.json = true;
    else if (a === "--keep-temp") opts.keepTemp = true;
    else if (a === "--cwd" && args[i + 1]) opts.cwd = args[++i];
    else if (a.startsWith("--cwd=")) opts.cwd = a.slice("--cwd=".length);
    else if (a === "--home-dir" && args[i + 1]) opts.homeDir = args[++i];
    else if (a.startsWith("--home-dir=")) opts.homeDir = a.slice("--home-dir=".length);
  }
  return opts;
}
async function executeE2EEvaluate(opts = {}) {
  const tempRoot = fs8.mkdtempSync(path9.join(os8.tmpdir(), "teamagent-e2e-"));
  const workspaceDir = opts.cwd ?? path9.join(tempRoot, "project");
  const homeDir = opts.homeDir ?? path9.join(tempRoot, "home");
  const sessionsDir = path9.join(tempRoot, "sessions");
  fs8.mkdirSync(workspaceDir, { recursive: true });
  fs8.mkdirSync(homeDir, { recursive: true });
  fs8.mkdirSync(sessionsDir, { recursive: true });
  fs8.mkdirSync(path9.join(workspaceDir, "src"), { recursive: true });
  fs8.mkdirSync(path9.join(workspaceDir, "docs"), { recursive: true });
  fs8.writeFileSync(path9.join(workspaceDir, "package.json"), JSON.stringify({ type: "module" }));
  const projectDbPath = path9.join(workspaceDir, ".teamagent", "knowledge.db");
  const userGlobalDbPath = path9.join(homeDir, ".teamagent", "global.db");
  const eventsDbPath = path9.join(homeDir, ".teamagent", "events.db");
  const claudeMdPath = path9.join(workspaceDir, "CLAUDE.md");
  const now = opts.now ?? (() => /* @__PURE__ */ new Date("2026-04-24T00:00:00Z"));
  const llmClient = opts.llmClient ?? deterministicLLM();
  const failures = [];
  let correctionsFound = 0;
  let extracted = 0;
  let idSeq = 0;
  try {
    for (const c of CASES) {
      const sessionPath = path9.join(sessionsDir, `${c.id}.jsonl`);
      fs8.writeFileSync(sessionPath, makeSessionJsonl(c), "utf-8");
      let meta;
      await executeAnalyze({
        session: sessionPath,
        homeDir,
        cwd: workspaceDir,
        commit: true,
        llmClient,
        projectDbPath,
        userGlobalDbPath,
        eventsDbPath,
        claudeMdPath,
        idGen: () => `e2e-${++idSeq}`,
        now,
        skipCalibrate: true,
        onMeta: (m) => {
          meta = m;
        }
      });
      correctionsFound += meta?.correctionsFound ?? 0;
      extracted += meta?.extracted ?? 0;
    }
    const store = new DualLayerStore({ projectDbPath, userGlobalDbPath });
    const eventLog = new SqliteEventLog(openDb(eventsDbPath));
    let lastRuleCount = 0;
    const matcher = {
      match: async ({ tool_name, tool_input }) => {
        const rules2 = store.findActive();
        lastRuleCount = rules2.length;
        return matchRules2(
          {
            ...typeof tool_input === "object" && tool_input !== null ? tool_input : {},
            tool_name
          },
          rules2,
          {}
        );
      }
    };
    const handler = createPreToolUseHandler({
      matcher,
      eventLog,
      visibility: "silent",
      get ruleCount() {
        return lastRuleCount;
      }
    });
    const rules = store.findActive();
    const probes = [];
    for (const c of CASES) {
      for (const probe of c.probes) {
        const result = await handler({
          hook_event_name: "PreToolUse",
          tool_use_id: `probe-${probe.id}`,
          tool_name: probe.tool_name,
          tool_input: probe.tool_input
        });
        const message = result.permissionDecisionReason ?? result.systemMessage ?? "";
        const triggered = result.permissionDecision !== "allow" || message.length > 0;
        const helpful = triggered && message.toLowerCase().includes(c.expectedCorrect.toLowerCase());
        probes.push({
          id: probe.id,
          kind: probe.kind,
          triggered,
          helpful,
          expectedTrigger: probe.kind !== "negative",
          decision: result.permissionDecision,
          message
        });
      }
    }
    eventLog.close();
    store.close();
    const positives = probes.filter((p) => p.kind === "positive");
    const generalizations = probes.filter((p) => p.kind === "generalization");
    const negatives = probes.filter((p) => p.kind === "negative");
    const triggeredHelpful = probes.filter((p) => p.expectedTrigger && p.triggered);
    const compiledClaudeMd = fs8.existsSync(claudeMdPath);
    const claudeMd = compiledClaudeMd ? fs8.readFileSync(claudeMdPath, "utf-8") : "";
    const claudeMdLower = claudeMd.toLowerCase();
    const claudeMdHasRules = CASES.every((c) => claudeMdLower.includes(c.expectedCorrect.toLowerCase()));
    const onboardingCoverage = CASES.length === 0 ? 1 : CASES.filter(
      (c) => claudeMdLower.includes(c.expectedWrong.toLowerCase()) && claudeMdLower.includes(c.expectedCorrect.toLowerCase())
    ).length / CASES.length;
    const metrics = {
      extractionYield: correctionsFound === 0 ? 0 : extracted / correctionsFound,
      positiveTriggerRate: rate(positives.filter((p) => p.triggered).length, positives.length),
      generalizationRate: rate(generalizations.filter((p) => p.triggered).length, generalizations.length),
      falsePositiveRate: rate(negatives.filter((p) => p.triggered).length, negatives.length),
      helpfulRate: rate(triggeredHelpful.filter((p) => p.helpful).length, triggeredHelpful.length),
      onboardingCoverage
    };
    if (rules.length < CASES.length) failures.push(`Only learned ${rules.length}/${CASES.length} rules.`);
    if (metrics.extractionYield < 1) failures.push(`Extraction yield ${fmtPct(metrics.extractionYield)} is below 100%.`);
    if (metrics.positiveTriggerRate < 1) failures.push(`Positive trigger rate ${fmtPct(metrics.positiveTriggerRate)} is below 100%.`);
    if (metrics.generalizationRate < 1) failures.push(`Generalization rate ${fmtPct(metrics.generalizationRate)} is below 100%.`);
    if (metrics.falsePositiveRate > 0) failures.push(`False positive rate ${fmtPct(metrics.falsePositiveRate)} is above 0%.`);
    if (metrics.helpfulRate < 1) failures.push(`Helpful message rate ${fmtPct(metrics.helpfulRate)} is below 100%.`);
    if (!compiledClaudeMd) failures.push("CLAUDE.md was not compiled.");
    if (!claudeMdHasRules) failures.push("CLAUDE.md does not contain every learned correction.");
    if (metrics.onboardingCoverage < 1) failures.push(`Onboarding coverage ${fmtPct(metrics.onboardingCoverage)} is below 100%.`);
    const shouldClean = !opts.keepTemp && !opts.cwd && !opts.homeDir;
    if (shouldClean) cleanupTempRoot(tempRoot);
    return {
      ok: failures.length === 0,
      workspaceDir,
      homeDir,
      learnedRules: rules.length,
      correctionsFound,
      extracted,
      compiledClaudeMd,
      claudeMdHasRules,
      metrics,
      probes,
      failures,
      tempCleaned: shouldClean
    };
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
    if (!opts.keepTemp && !opts.cwd && !opts.homeDir) cleanupTempRoot(tempRoot);
    return {
      ok: false,
      workspaceDir,
      homeDir,
      learnedRules: 0,
      correctionsFound,
      extracted,
      compiledClaudeMd: fs8.existsSync(claudeMdPath),
      claudeMdHasRules: false,
      metrics: {
        extractionYield: correctionsFound === 0 ? 0 : extracted / correctionsFound,
        positiveTriggerRate: 0,
        generalizationRate: 0,
        falsePositiveRate: 0,
        helpfulRate: 0,
        onboardingCoverage: 0
      },
      probes: [],
      failures,
      tempCleaned: !opts.keepTemp && !opts.cwd && !opts.homeDir
    };
  }
}
function renderE2EEvaluateResult(result) {
  const lines = [
    `TeamAgent real E2E evaluation: ${result.ok ? "PASS" : "FAIL"}`,
    "",
    `Rules learned: ${result.learnedRules}`,
    `Corrections found/extracted: ${result.correctionsFound}/${result.extracted}`,
    `CLAUDE.md compiled: ${result.compiledClaudeMd ? "yes" : "no"}`,
    `Onboarding rules in CLAUDE.md: ${fmtPct(result.metrics.onboardingCoverage)}`,
    "",
    "Metrics:",
    `  extraction yield: ${fmtPct(result.metrics.extractionYield)}`,
    `  positive trigger rate: ${fmtPct(result.metrics.positiveTriggerRate)}`,
    `  generalization rate: ${fmtPct(result.metrics.generalizationRate)}`,
    `  false positive rate: ${fmtPct(result.metrics.falsePositiveRate)}`,
    `  helpful message rate: ${fmtPct(result.metrics.helpfulRate)}`,
    "",
    "Probe results:",
    ...result.probes.map((p) => {
      const expected = p.expectedTrigger ? "hit" : "pass";
      const actual = p.triggered ? "hit" : "pass";
      const status = expected === actual ? "ok" : "bad";
      return `  ${status} ${p.id} [${p.kind}]: expected ${expected}, got ${actual}`;
    })
  ];
  if (result.failures.length > 0) {
    lines.push("", "Failures:", ...result.failures.map((f) => `  - ${f}`));
  }
  if (!result.tempCleaned) {
    lines.push("", `Workspace: ${result.workspaceDir}`, `Home: ${result.homeDir}`);
  }
  return lines.join("\n") + "\n";
}
function makeSessionJsonl(c) {
  const sessionId = `e2e-${c.id}`;
  const lines = [
    {
      type: "user",
      uuid: `${c.id}-u1`,
      timestamp: "2026-04-24T00:00:00Z",
      sessionId,
      message: { role: "user", content: c.userRequest }
    },
    {
      type: "assistant",
      uuid: `${c.id}-a1`,
      timestamp: "2026-04-24T00:00:01Z",
      sessionId,
      message: {
        role: "assistant",
        content: [
          { type: "text", text: c.assistantText },
          { type: "tool_use", id: `${c.id}-tool1`, name: c.toolName, input: c.toolInput }
        ]
      }
    },
    {
      type: "user",
      uuid: `${c.id}-u2`,
      timestamp: "2026-04-24T00:00:02Z",
      sessionId,
      message: { role: "user", content: c.correctionText }
    }
  ];
  return lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
}
function deterministicLLM() {
  return {
    complete: async (prompt) => {
      const lower = prompt.toLowerCase();
      const found = lower.includes("zustand") ? CASES.find((c) => c.id === "state-library") : lower.includes("dayjs") ? CASES.find((c) => c.id === "date-library") : lower.includes("fetch instead of axios") ? CASES.find((c) => c.id === "http-client") : void 0;
      if (!found) return "null";
      return "```json\n" + JSON.stringify(found.llm) + "\n```";
    }
  };
}
function rate(n, d) {
  return d === 0 ? 1 : n / d;
}
function fmtPct(v) {
  return `${Math.round(v * 1e3) / 10}%`;
}
function cleanupTempRoot(tempRoot) {
  try {
    fs8.rmSync(tempRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100
    });
  } catch {
  }
}

// ../cli/src/commands/dogfood-report.ts
init_esm_shims();
import os9 from "os";
import path10 from "path";
import fs9 from "fs";
import { execSync } from "child_process";
function resolvePaths3(opts) {
  const home = opts.homeDir ?? os9.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    home,
    cwd,
    projectDbPath: opts.projectDbPath ?? path10.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath: opts.userGlobalDbPath ?? path10.join(home, ".teamagent", "global.db"),
    eventsDbPath: opts.eventsDbPath ?? path10.join(home, ".teamagent", "events.db"),
    outputPath: opts.outputPath ?? path10.join(cwd, "docs", "dogfood", "\u81EA\u4E3E\u62A5\u544A.md")
  };
}
function readGitTimeline(cwd) {
  try {
    const out = execSync(
      'git log --pretty=format:"%h|%ad|%s" --date=short -100',
      // stdio: pipe stderr so a missing .git directory does not leak
      // "fatal: not a git repository" to the user's terminal — the catch
      // below already returns []. Without "ignore" / "pipe" stderr, the
      // child writes directly to our stderr.
      { cwd, encoding: "utf-8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    return out.split("\n").map((line) => {
      const [hash, date, ...rest] = line.split("|");
      return { hash: hash ?? "", date: date ?? "", message: rest.join("|") };
    }).filter((c) => c.hash);
  } catch {
    return [];
  }
}
async function executeDogfoodReport(opts = {}) {
  const paths = resolvePaths3(opts);
  const now = (opts.now ?? (() => /* @__PURE__ */ new Date()))();
  let allEntries = [];
  try {
    fs9.mkdirSync(path10.dirname(paths.projectDbPath), { recursive: true });
    fs9.mkdirSync(path10.dirname(paths.userGlobalDbPath), { recursive: true });
    if (fs9.existsSync(paths.projectDbPath) || fs9.existsSync(paths.userGlobalDbPath)) {
      const store = new DualLayerStore({
        projectDbPath: paths.projectDbPath,
        userGlobalDbPath: paths.userGlobalDbPath
      });
      allEntries = store.getAll();
      store.close();
    }
  } catch {
  }
  const personal = allEntries.filter((e) => e.scope.level === "personal");
  const global = allEntries.filter((e) => e.scope.level === "global");
  let events = [];
  try {
    if (fs9.existsSync(paths.eventsDbPath)) {
      const eventLog = new SqliteEventLog(openDb(paths.eventsDbPath));
      events = eventLog.readAll();
      eventLog.close();
    }
  } catch {
  }
  const timeline = readGitTimeline(paths.cwd);
  const triggerById = /* @__PURE__ */ new Map();
  for (const e of allEntries) triggerById.set(e.id, e.trigger);
  const fireCount = /* @__PURE__ */ new Map();
  for (const e of events) {
    if (e.knowledge_id && /^hook-pre/.test(e.kind)) {
      fireCount.set(e.knowledge_id, (fireCount.get(e.knowledge_id) ?? 0) + 1);
    }
  }
  const topFired = [...fireCount.entries()].map(([knowledge_id, fires]) => ({
    knowledge_id,
    trigger: triggerById.get(knowledge_id) ?? "(\u5DF2\u5220)",
    fires
  })).sort((a, b) => b.fires - a.fires).slice(0, 5);
  const deltaById = /* @__PURE__ */ new Map();
  for (const e of events) {
    if (e.kind === "calibrator.adjusted" && e.knowledge_id && typeof e.confidence_before === "number" && typeof e.confidence_after === "number") {
      const d = e.confidence_after - e.confidence_before;
      deltaById.set(e.knowledge_id, (deltaById.get(e.knowledge_id) ?? 0) + d);
    }
  }
  const topConfidenceGain = [...deltaById.entries()].map(([knowledge_id, totalDelta]) => ({
    knowledge_id,
    trigger: triggerById.get(knowledge_id) ?? "(\u5DF2\u5220)",
    totalDelta
  })).sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta)).slice(0, 5);
  const archivedCount = allEntries.filter((e) => e.status === "archived").length;
  const md = renderDogfoodReport({
    now,
    personal,
    team: [],
    global,
    events,
    timeline,
    topFired,
    topConfidenceGain,
    archivedCount
  });
  fs9.mkdirSync(path10.dirname(paths.outputPath), { recursive: true });
  fs9.writeFileSync(paths.outputPath, md, "utf-8");
  return {
    outputPath: paths.outputPath,
    totalEntries: allEntries.length,
    totalEvents: events.length,
    scopes: { personal: personal.length, team: 0, global: global.length },
    topFired,
    topConfidenceGain,
    archivedCount
  };
}
function renderDogfoodReport(input) {
  const { now, personal, team, global, events, timeline, topFired, topConfidenceGain, archivedCount } = input;
  const all = [...personal, ...team, ...global];
  const active = all.filter((e) => e.status === "active");
  const byCategory = { C: 0, E: 0, S: 0, K: 0 };
  for (const e of active) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  const eventKinds = {};
  for (const e of events) eventKinds[e.kind] = (eventKinds[e.kind] ?? 0) + 1;
  const corrections = events.filter((e) => /^hook-pre/.test(e.kind)).length;
  const calibrations = events.filter((e) => e.kind === "calibrator.adjusted").length;
  const lines = [];
  lines.push("# TeamAgent \u81EA\u4E3E\u62A5\u544A\uFF08Phase 2\uFF09");
  lines.push("");
  lines.push(`> \u751F\u6210\u65F6\u95F4: ${now.toISOString()}`);
  lines.push("> \u6570\u636E\u5B8C\u5168\u6765\u81EA\u7CFB\u7EDF\u81EA\u8EAB\uFF1Aevents.db + knowledge.db + git log");
  lines.push("> \u7531 `teamagent dogfood-report` \u81EA\u52A8\u751F\u6210\uFF0C\u672A\u7ECF\u4EBA\u5DE5\u4FEE\u9970");
  lines.push("");
  lines.push("## \u4E00\u53E5\u8BDD\u7ED3\u8BBA");
  lines.push("");
  lines.push(
    `Phase 2 \u671F\u95F4\u7D2F\u8BA1\u79EF\u7D2F **${all.length} \u6761\u77E5\u8BC6**\uFF08${active.length} \u6761\u6D3B\u8DC3${archivedCount > 0 ? `\u3001${archivedCount} \u6761\u81EA\u52A8\u5F52\u6863` : ""}\uFF09\uFF0CHook \u62E6\u622A **${corrections} \u6B21**\uFF0CCalibrator \u8C03\u6574 **${calibrations} \u6B21**\u3002`
  );
  lines.push("");
  lines.push("## \u77E5\u8BC6\u5E93");
  lines.push("");
  lines.push("| \u7EF4\u5EA6 | \u503C |");
  lines.push("|------|----|");
  lines.push(`| \u603B\u6761\u76EE | ${all.length} |`);
  lines.push(`| \u6D3B\u8DC3 | ${active.length} |`);
  lines.push(`| \u81EA\u52A8\u5F52\u6863 | ${archivedCount} |`);
  lines.push(`| personal | ${personal.length} |`);
  lines.push(`| global | ${global.length} |`);
  lines.push(`| C \u4EE3\u7801\u5C42 | ${byCategory.C} |`);
  lines.push(`| E \u5DE5\u7A0B\u5C42 | ${byCategory.E} |`);
  lines.push(`| S \u7B56\u7565\u5C42 | ${byCategory.S} |`);
  lines.push(`| K \u8BA4\u77E5\u5C42 | ${byCategory.K} |`);
  lines.push("");
  lines.push("## Hook \u5E72\u9884\u7EDF\u8BA1");
  lines.push("");
  lines.push("| \u4E8B\u4EF6\u7C7B\u578B | \u6B21\u6570 |");
  lines.push("|---------|------|");
  for (const [k, v] of Object.entries(eventKinds).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");
  lines.push(`## \u547D\u4E2D\u9891\u6B21 Top ${topFired.length}`);
  lines.push("");
  if (topFired.length === 0) {
    lines.push("(\u6682\u65E0\u547D\u4E2D\u8BB0\u5F55)");
  } else {
    lines.push("| # | \u547D\u4E2D\u6570 | trigger | id |");
    lines.push("|---|-------|---------|-----|");
    topFired.forEach((r, i) => {
      lines.push(
        `| ${i + 1} | ${r.fires} | ${r.trigger.slice(0, 60)} | ${r.knowledge_id} |`
      );
    });
  }
  lines.push("");
  lines.push(`## Confidence \u53D8\u5316 Top ${topConfidenceGain.length}`);
  lines.push("");
  if (topConfidenceGain.length === 0) {
    lines.push("(\u6682\u65E0\u6821\u51C6\u8BB0\u5F55\u2014\u2014\u5C1A\u672A\u8DD1\u8FC7 calibrate)");
  } else {
    lines.push("| # | \u0394confidence | trigger | id |");
    lines.push("|---|------------|---------|-----|");
    topConfidenceGain.forEach((r, i) => {
      const sign = r.totalDelta > 0 ? "+" : "";
      lines.push(
        `| ${i + 1} | ${sign}${r.totalDelta.toFixed(2)} | ${r.trigger.slice(0, 60)} | ${r.knowledge_id} |`
      );
    });
  }
  lines.push("");
  lines.push("## Phase 2 git \u65F6\u95F4\u7EBF");
  lines.push("");
  if (timeline.length === 0) {
    lines.push("(\u65E0 git \u5386\u53F2)");
  } else {
    const milestones = timeline.filter(
      (c) => /^(feat|fix|chore|test|docs|ci)\((m[0-9]+|stage0|compiler|hotfix)\)/.test(
        c.message
      )
    );
    lines.push("| date | hash | message |");
    lines.push("|------|------|---------|");
    for (const c of milestones.slice(0, 30)) {
      lines.push(`| ${c.date} | ${c.hash} | ${c.message.slice(0, 80)} |`);
    }
  }
  lines.push("");
  lines.push("## \u5173\u4E8E\u8FD9\u4EFD\u62A5\u544A");
  lines.push("");
  lines.push(
    "Phase 2 \u8BBE\u8BA1\u610F\u56FE\uFF1A\u7CFB\u7EDF**\u81EA\u52A8\u751F\u6210**\u4E00\u4EFD\u62A5\u544A\uFF0C\u4F5C\u4E3A\u5BF9 'TeamAgent \u662F\u5426\u771F\u6709\u7528' \u8FD9\u4E2A\u95EE\u9898\u7684**\u7B2C\u4E09\u65B9\u72EC\u7ACB\u8BC1\u636E**\u2014\u2014\u6240\u6709\u6570\u5B57\u6765\u81EA\u78C1\u76D8\u4E0A\u7684 SQLite DB\uFF0C\u6CA1\u4EBA\u624B\u52A8\u6539\u3002"
  );
  return lines.join("\n") + "\n";
}
function parseDogfoodReportArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output" && argv[i + 1]) {
      opts.outputPath = argv[i + 1];
      i++;
    } else if (a.startsWith("--output=")) {
      opts.outputPath = a.slice("--output=".length);
    }
  }
  return opts;
}

// ../cli/src/commands/ingest.ts
init_esm_shims();
import os10 from "os";
import path12 from "path";
import fs11 from "fs";
import { execSync as execSync2 } from "child_process";

// ../adapters/src/ingest/insights.ts
init_esm_shims();
var InsightItemSchema = external_exports.object({
  type: external_exports.string(),
  text: external_exports.string().min(1),
  weight: external_exports.number().min(0).max(1).default(0.7)
});
var InsightsReportSchema = external_exports.object({
  insights: external_exports.array(InsightItemSchema)
});
function parseInsightsReport(raw) {
  const parsed = InsightsReportSchema.parse(JSON.parse(raw));
  return parsed.insights.map((item) => ({
    kind: "insights",
    context: `[type=${item.type}] ${item.text}`,
    weight: item.weight
  }));
}

// ../adapters/src/ingest/npm-audit.ts
init_esm_shims();
import fs10 from "fs";
import path11 from "path";
function parseNpmAudit(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object") return [];
  const vulns = data.vulnerabilities;
  if (!vulns || typeof vulns !== "object") return [];
  const out = [];
  for (const [pkg, rawVuln] of Object.entries(
    vulns
  )) {
    if (!rawVuln || typeof rawVuln !== "object") continue;
    const v = rawVuln;
    const severity = typeof v.severity === "string" ? v.severity.toLowerCase() : "";
    if (severity !== "high" && severity !== "critical") continue;
    const title = typeof v.title === "string" ? v.title : "";
    const url = typeof v.url === "string" ? v.url : "";
    out.push({
      kind: "npm-audit",
      context: `[severity=${severity}] ${pkg}: ${title} (${url || "no url"})`,
      weight: severity === "critical" ? 1 : 0.8
    });
  }
  return out;
}
function detectAuditCmd(cwd) {
  const dir = cwd ?? process.cwd();
  if (fs10.existsSync(path11.join(dir, "pnpm-lock.yaml"))) return "pnpm audit --json";
  if (fs10.existsSync(path11.join(dir, "yarn.lock"))) return "yarn audit --json";
  return "npm audit --json";
}
async function getNpmAuditOutput(runner, cwd) {
  const cmd = detectAuditCmd(cwd);
  try {
    return await runner(cmd, { cwd });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/\{[\s\S]*\}$/);
    if (match) return match[0];
    throw err;
  }
}

// ../adapters/src/ingest/pr-review.ts
init_esm_shims();
function parseGhPrReviews(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object") return [];
  const reviews = data.reviews;
  if (!Array.isArray(reviews)) return [];
  const out = [];
  for (const r of reviews) {
    if (!r || typeof r !== "object") continue;
    const body = typeof r.body === "string" ? r.body : "";
    const state = typeof r.state === "string" ? r.state : "";
    if (body.trim().length < 10) continue;
    if (state === "APPROVED") continue;
    const weight = state === "CHANGES_REQUESTED" ? 0.9 : 0.5;
    out.push({
      kind: "pr-review",
      context: `[state=${state || "unknown"}] ${body}`,
      weight
    });
  }
  return out;
}
async function getGhPrReviews(prNumber, runner) {
  return runner(`gh pr view ${prNumber} --json reviews`);
}
async function isGhAvailable(runner) {
  try {
    await runner("gh --version");
    return true;
  } catch {
    return false;
  }
}

// ../adapters/src/ingest/git-hotspot.ts
init_esm_shims();
var NUMSTAT_LINE = /^\s*(\d+|-)\s+(\d+|-)\s+(\S.*)$/;
function parseGitHotspots(logOutput, opts = {}) {
  const threshold = opts.threshold ?? 3;
  const counts = /* @__PURE__ */ new Map();
  for (const line of logOutput.split(/\r?\n/)) {
    const m = line.match(NUMSTAT_LINE);
    if (!m) continue;
    const filePath = m[3];
    counts.set(filePath, (counts.get(filePath) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c >= threshold).map(([path19, change_count]) => ({ path: path19, change_count })).sort((a, b) => b.change_count - a.change_count);
}
function hotspotsToCandidateItems(hotspots) {
  return hotspots.map((h) => ({
    label: `${h.path} (changed ${h.change_count} times)`
  }));
}
async function getGitNumstat(runner, opts = {}) {
  const since = opts.sinceDays ? `--since="${opts.sinceDays} days ago"` : "";
  const cmd = `git log ${since} --numstat --pretty=format:"commit %H"`;
  return runner(cmd, { cwd: opts.cwd });
}

// ../adapters/src/ingest/ci-failure.ts
init_esm_shims();
function parseGhRunList(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const r of data) {
    if (!r || typeof r !== "object") continue;
    const row = r;
    if (typeof row.databaseId !== "number") continue;
    out.push({
      id: row.databaseId,
      name: typeof row.name === "string" ? row.name : "",
      branch: typeof row.headBranch === "string" ? row.headBranch : "",
      createdAt: typeof row.createdAt === "string" ? row.createdAt : ""
    });
  }
  return out;
}
function runsToCandidateItems(runs) {
  return runs.map((r) => ({
    label: `Run #${r.id} (${r.name}, branch ${r.branch}) \u2014 ${r.createdAt}`
  }));
}
async function getGhRunList(runner, opts = {}) {
  const limit = opts.limit ?? 30;
  return runner(
    `gh run list --status=failure --json databaseId,name,headBranch,createdAt,conclusion --limit ${limit}`
  );
}
function filterBySince(runs, sinceDays, now) {
  if (!sinceDays || sinceDays <= 0) return runs;
  const cutoff = now.getTime() - sinceDays * 24 * 3600 * 1e3;
  return runs.filter((r) => {
    const t = Date.parse(r.createdAt);
    return Number.isNaN(t) ? true : t >= cutoff;
  });
}

// ../adapters/src/ingest/candidate-md.ts
init_esm_shims();
var SOURCE_COMMENT_RE = /<!--\s*teamagent-candidate-source:\s*([\w-]+)\s*-->/;
var CHECKBOX_LINE_RE = /^\s*-\s*\[([ xX])\]\s+(.+?)\s*$/;
function formatCandidateMd(source, items, opts = {}) {
  const lines = [];
  lines.push(`# TeamAgent ingest candidates (${source})`);
  lines.push(`<!-- teamagent-candidate-source: ${source} -->`);
  if (opts.generatedAt) {
    lines.push(`<!-- generated-at: ${opts.generatedAt} -->`);
  }
  lines.push("");
  lines.push("\u52FE\u9009 `[x]` \u4FDD\u7559\u60F3\u6444\u5165\u7684\u5019\u9009\uFF0C\u7136\u540E\u8DD1\uFF1A");
  lines.push("");
  lines.push("```");
  lines.push(`teamagent ingest --from-candidates <this-file>`);
  lines.push("```");
  lines.push("");
  if (items.length === 0) {
    lines.push("_(\u65E0\u5019\u9009)_");
  } else {
    for (const item of items) {
      lines.push(`- [ ] ${item.label}`);
      if (item.meta) lines.push(`      ${item.meta}`);
    }
  }
  return lines.join("\n") + "\n";
}
function parseCandidateMd(md) {
  const sourceMatch = md.match(SOURCE_COMMENT_RE);
  if (!sourceMatch) {
    throw new Error(
      "candidate md \u7F3A\u5C11 <!-- teamagent-candidate-source: ... --> \u6807\u8BB0"
    );
  }
  const source = sourceMatch[1];
  if (source !== "git-hotspot" && source !== "ci-failure") {
    throw new Error(`\u672A\u77E5 candidate source: ${source}`);
  }
  const checked = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(CHECKBOX_LINE_RE);
    if (!m) continue;
    const mark = m[1];
    if (mark !== "x" && mark !== "X") continue;
    checked.push(m[2]);
  }
  return { source, checked };
}
function candidatesToExtractionInputs(parsed) {
  const kind = parsed.source;
  return parsed.checked.map((label) => ({
    kind,
    context: label,
    weight: 0.5
  }));
}

// ../cli/src/commands/ingest.ts
function resolvePaths4(opts) {
  const home = opts.homeDir ?? os10.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    cwd,
    home,
    projectDbPath: opts.projectDbPath ?? path12.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath: opts.userGlobalDbPath ?? path12.join(home, ".teamagent", "global.db"),
    claudeMdPath: opts.claudeMdPath ?? path12.join(cwd, "CLAUDE.md"),
    candidatesDir: path12.join(cwd, ".teamagent", "candidates")
  };
}
function detectProjectStack(cwd) {
  try {
    const presence = {
      exists: (rel) => fs11.existsSync(path12.join(cwd, rel)),
      read: (rel) => {
        const full = path12.join(cwd, rel);
        return fs11.existsSync(full) ? fs11.readFileSync(full, "utf-8") : void 0;
      }
    };
    const fp = detectStack(presence);
    const langToFt = {
      typescript: "ts",
      javascript: "js",
      python: "py",
      go: "go",
      rust: "rs",
      java: "java"
    };
    return fp.languages.map((l) => langToFt[l] ?? l);
  } catch {
    return [];
  }
}
async function defaultRunner(cmd, opts = {}) {
  return execSync2(cmd, {
    cwd: opts.cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });
}
async function loadInputs(opts) {
  switch (opts.source) {
    case "insights": {
      if (!opts.filePath) {
        throw new Error("--from-insights \u9700\u8981 <path>");
      }
      const raw = fs11.readFileSync(opts.filePath, "utf-8");
      return parseInsightsReport(raw);
    }
    case "npm-audit": {
      const runner = opts.cmdRunner ?? defaultRunner;
      const raw = await getNpmAuditOutput(runner, opts.cwd);
      return parseNpmAudit(raw);
    }
    case "git-hotspot": {
      throw new Error(
        "git-hotspot \u6E90\u53EA\u4EA7\u51FA\u5019\u9009\u6587\u4EF6\uFF0C\u4E0D\u76F4\u63A5 ingest\u3002\u89C1 executeIngest \u7684 handleSemiAuto\u3002"
      );
    }
    case "ci-failure": {
      throw new Error(
        "ci-failure \u6E90\u53EA\u4EA7\u51FA\u5019\u9009\u6587\u4EF6\uFF0C\u4E0D\u76F4\u63A5 ingest\u3002\u89C1 executeIngest \u7684 handleSemiAuto\u3002"
      );
    }
    case "candidates": {
      if (!opts.filePath) {
        throw new Error("--from-candidates \u9700\u8981 <path>");
      }
      const raw = fs11.readFileSync(opts.filePath, "utf-8");
      const parsed = parseCandidateMd(raw);
      return candidatesToExtractionInputs(parsed);
    }
    case "pr-review": {
      if (opts.prNumber === void 0 || Number.isNaN(opts.prNumber)) {
        throw new Error("--from-pr \u9700\u8981 <number>");
      }
      const runner = opts.cmdRunner ?? defaultRunner;
      const simpleRunner = (cmd) => runner(cmd, {});
      if (!await isGhAvailable(simpleRunner)) {
        throw new Error(
          "gh CLI \u672A\u5B89\u88C5\u3002\u53C2\u8003 https://cli.github.com \u5B89\u88C5\u540E\u91CD\u8BD5\u3002"
        );
      }
      const raw = await getGhPrReviews(opts.prNumber, simpleRunner);
      return parseGhPrReviews(raw);
    }
    default:
      throw new Error(`\u6E90 '${opts.source}' \u5C1A\u672A\u5B9E\u73B0\uFF08M2.3 \u540E\u7EED task\uFF09`);
  }
}
async function executeIngest(opts) {
  const paths = resolvePaths4(opts);
  const dryRun = opts.dryRun ?? false;
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const idGen = opts.idGen ?? (() => {
    const ts = now().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const rand = Math.random().toString(36).slice(2, 8);
    return `ing-${ts}-${rand}`;
  });
  if (opts.source === "git-hotspot" || opts.source === "ci-failure") {
    return handleSemiAuto(opts, paths, now);
  }
  fs11.mkdirSync(path12.dirname(paths.projectDbPath), { recursive: true });
  fs11.mkdirSync(path12.dirname(paths.userGlobalDbPath), { recursive: true });
  let inputs;
  try {
    inputs = await loadInputs(opts);
  } catch (err) {
    return `\u2717 \u52A0\u8F7D ingest \u6E90\u5931\u8D25: ${String(err).slice(0, 200)}
`;
  }
  if (inputs.length === 0) {
    return `\u2713 ingest \u6E90 '${opts.source}' \u626B\u63CF\u5B8C\u6210\uFF1A0 \u6761\u5019\u9009
`;
  }
  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  const dualStore = new DualLayerStore({
    projectDbPath: paths.projectDbPath,
    userGlobalDbPath: paths.userGlobalDbPath
  });
  const projectStore = dualStore.getProjectStore();
  const projectStack = detectProjectStack(paths.cwd);
  const validator = { validateLevel0 };
  const result = await runIngestPipeline({
    inputs,
    extractor: llmBasedKnowledgeExtractor,
    callLLM: (prompt) => llm.complete(prompt),
    validator,
    store: projectStore,
    scope: { level: "personal" },
    source: "ingested",
    projectStack,
    now,
    idGen,
    dryRun
  });
  if (!dryRun && result.accepted.length > 0) {
    try {
      const all = dualStore.findActive();
      new MarkdownCompiler(paths.claudeMdPath, () => now().toISOString()).writeToFile(all);
    } catch {
    }
  }
  dualStore.close();
  return formatReport(opts.source, result, dryRun);
}
function formatReport(source, result, dryRun) {
  const lines = [];
  lines.push(
    dryRun ? `\u{1F50D} TeamAgent Ingest (${source}, dry-run)` : `\u{1F4E5} TeamAgent Ingest (${source})`
  );
  lines.push("");
  lines.push(`  \u626B\u63CF: ${result.scanned}`);
  lines.push(`  \u5165\u5E93: ${result.accepted.length}`);
  lines.push(`  L0 \u62D2\u7EDD: ${result.rejected.length}`);
  lines.push(`  LLM \u8DF3\u8FC7: ${result.skipped}`);
  lines.push(`  \u5931\u8D25: ${result.failed}`);
  if (result.accepted.length > 0) {
    lines.push("");
    lines.push("  \u65B0\u589E\u6761\u76EE:");
    for (const e of result.accepted.slice(0, 5)) {
      lines.push(
        `    - [${e.category}/${e.tags[0] ?? "untagged"}] ${e.trigger} \u2192 ${e.correct_pattern}`
      );
    }
    if (result.accepted.length > 5) {
      lines.push(`    ... (${result.accepted.length - 5} more)`);
    }
  }
  if (result.rejected.length > 0) {
    lines.push("");
    lines.push("  L0 \u62D2\u7EDD\u6458\u8981:");
    const reasonCounts = {};
    for (const r of result.rejected) {
      for (const reason of r.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      }
    }
    for (const [reason, n] of Object.entries(reasonCounts)) {
      lines.push(`    - ${reason}: ${n}`);
    }
  }
  return lines.join("\n") + "\n";
}
function parseIngestArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--from-insights" && argv[i + 1]) {
      opts.source = "insights";
      opts.filePath = argv[++i];
    } else if (a === "--from-audit") {
      opts.source = "npm-audit";
    } else if (a === "--from-pr" && argv[i + 1]) {
      opts.source = "pr-review";
      opts.prNumber = parseInt(argv[++i], 10);
    } else if (a === "--from-git") {
      opts.source = "git-hotspot";
    } else if (a === "--from-ci") {
      opts.source = "ci-failure";
    } else if (a === "--from-candidates" && argv[i + 1]) {
      opts.source = "candidates";
      opts.filePath = argv[++i];
    } else if (a.startsWith("--since=")) {
      const raw = a.slice("--since=".length);
      const m = raw.match(/^(\d+)d?$/);
      if (m) {
        opts.sinceDays = parseInt(m[1], 10);
      } else if (raw) {
        throw new Error(`--since \u683C\u5F0F\u65E0\u6548: "${raw}"\u3002\u63A5\u53D7\u683C\u5F0F: "30d" \u6216 "45"\uFF08\u5929\u6570\uFF09`);
      }
    } else if (a.startsWith("--threshold=")) {
      opts.threshold = parseInt(a.slice("--threshold=".length), 10);
    }
  }
  if (!opts.source) {
    throw new Error(
      "ingest \u9700\u8981\u6E90\u6807\u8BB0\uFF1A--from-insights / --from-audit / --from-pr / --from-git / --from-ci / --from-candidates"
    );
  }
  return opts;
}
async function handleSemiAuto(opts, paths, now) {
  fs11.mkdirSync(paths.candidatesDir, { recursive: true });
  const runner = opts.cmdRunner ?? defaultRunner;
  const dateSlug = now().toISOString().slice(0, 10);
  if (opts.source === "git-hotspot") {
    const raw = await getGitNumstat(runner, {
      cwd: paths.cwd,
      sinceDays: opts.sinceDays
    });
    const hotspots = parseGitHotspots(raw, { threshold: opts.threshold });
    const items = hotspotsToCandidateItems(hotspots);
    const md = formatCandidateMd("git-hotspot", items, {
      generatedAt: now().toISOString()
    });
    const outPath = path12.join(
      paths.candidatesDir,
      `git-hotspot-${dateSlug}.md`
    );
    fs11.writeFileSync(outPath, md, "utf-8");
    return formatSemiAutoReport("git-hotspot", items.length, outPath);
  }
  if (opts.source === "ci-failure") {
    const simpleRunner = (cmd) => runner(cmd, {});
    if (!await isGhAvailable(simpleRunner)) {
      throw new Error(
        "gh CLI \u672A\u5B89\u88C5\u3002--from-ci \u9700\u8981 gh\uFF1B\u53C2\u8003 https://cli.github.com\u3002"
      );
    }
    const raw = await getGhRunList(simpleRunner, { limit: 30 });
    const allRuns = parseGhRunList(raw);
    const runs = filterBySince(allRuns, opts.sinceDays, now());
    const items = runsToCandidateItems(runs);
    const md = formatCandidateMd("ci-failure", items, {
      generatedAt: now().toISOString()
    });
    const outPath = path12.join(paths.candidatesDir, `ci-failure-${dateSlug}.md`);
    fs11.writeFileSync(outPath, md, "utf-8");
    return formatSemiAutoReport("ci-failure", items.length, outPath);
  }
  throw new Error(`semi-auto source '${opts.source}' \u672A\u5B9E\u73B0`);
}
function formatSemiAutoReport(source, candidateCount, outPath) {
  return [
    `\u{1F50D} TeamAgent Ingest (${source}, \u5019\u9009\u751F\u6210)`,
    "",
    `  \u5019\u9009\u6570: ${candidateCount}`,
    `  \u5199\u5165: ${outPath}`,
    "",
    `  \u7F16\u8F91\u8BE5\u6587\u4EF6\uFF0C\u628A\u60F3\u6444\u5165\u7684\u6761\u76EE\u6539\u4E3A - [x]\uFF0C\u7136\u540E\u8FD0\u884C\uFF1A`,
    `    teamagent ingest --from-candidates ${outPath}`,
    ""
  ].join("\n");
}

// ../cli/src/commands/config.ts
init_esm_shims();
import fs12 from "fs";
import path13 from "path";
var DEFAULTS = {
  stop_mode: "async",
  stop_scan_errors: true,
  stop_scan_errors_timeout_ms: 9e4
};
function readTeamAgentConfig(cwd) {
  const file = path13.join(cwd, ".teamagent", "config.json");
  if (!fs12.existsSync(file)) return { ...DEFAULTS };
  try {
    const raw = fs12.readFileSync(file, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}
function writeTeamAgentConfig(cwd, patch) {
  const dir = path13.join(cwd, ".teamagent");
  const file = path13.join(dir, "config.json");
  fs12.mkdirSync(dir, { recursive: true });
  const existing = readTeamAgentConfig(cwd);
  const merged = { ...existing, ...patch };
  fs12.writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}
function executeConfig(opts) {
  const cwd = opts.cwd ?? process.cwd();
  if (opts.subcommand === "stop-mode") {
    const val = opts.value;
    if (val !== "sync" && val !== "async") {
      throw new Error(`Invalid stop-mode value: "${val}". Use "sync" or "async".`);
    }
    writeTeamAgentConfig(cwd, { stop_mode: val });
    return `stop_mode set to "${val}"`;
  }
  if (opts.subcommand === "show") {
    const cfg = readTeamAgentConfig(cwd);
    return JSON.stringify(cfg, null, 2);
  }
  throw new Error(`Unknown config subcommand: "${opts.subcommand}"`);
}

// ../cli/src/commands/doctor.ts
init_esm_shims();
import fs13 from "fs";
import path14 from "path";
import os11 from "os";
import { execSync as execSync3 } from "child_process";
import { createRequire } from "module";
var _require = createRequire(import.meta.url);
function parseDoctorArgs(argv) {
  return {
    fix: argv.includes("--fix"),
    json: argv.includes("--json"),
    postinstall: argv.includes("--postinstall")
  };
}
async function autoFix(check, opts) {
  if (check.status !== "fail") return;
  const cwd = opts.cwd ?? process.cwd();
  try {
    if (check.name === "knowledge-db") {
      const { executeInit: executeInit2 } = await import("./init-5XUQDFU2.js");
      await executeInit2({ cwd, skipImport: true });
    } else if (check.name === "hook-registered" || check.name === "hook-script") {
      const { installHook: installHook2 } = await import("./install-hook-76LXULCD.js");
      installHook2({ cwd });
    } else if (check.name === "claude-md") {
      const { executeCompile: executeCompile2 } = await import("./compile-DUJLMBMW.js");
      await executeCompile2({ cwd });
    }
  } catch {
  }
}
async function executeDoctor(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.homeDir ?? os11.homedir();
  const checks = [];
  const nodeCheck = checkNodeVersion();
  checks.push(nodeCheck);
  if (nodeCheck.status === "fail") {
    return finalize(checks, true);
  }
  const claudeCheck = checkClaudeCode();
  checks.push(claudeCheck);
  if (claudeCheck.status === "fail") {
    return finalize(checks, true);
  }
  checks.push(checkSqliteVec());
  const homeCheck = checkHomeDir(home);
  checks.push(homeCheck);
  if (homeCheck.status === "fail") {
    return finalize(checks, true);
  }
  const dbPath = path14.join(cwd, ".teamagent", "knowledge.db");
  const dbCheck = checkKnowledgeDb(dbPath);
  checks.push(dbCheck);
  if (opts.fix && dbCheck.status === "fail") await autoFix(dbCheck, opts);
  if (dbCheck.status === "fail" && !opts.fix) {
    checks.push(skip("hook-registered", "knowledge.db \u5148\u4FEE"));
    checks.push(skip("hook-script", "knowledge.db \u5148\u4FEE"));
    checks.push(skip("claude-md", "knowledge.db \u5148\u4FEE"));
    return finalize(checks, false);
  }
  const settingsPath = path14.join(cwd, ".claude", "settings.local.json");
  const hookCheck = checkHookRegistered(settingsPath);
  checks.push(hookCheck);
  if (opts.fix && hookCheck.status === "fail") await autoFix(hookCheck, opts);
  if (hookCheck.status === "fail" && !opts.fix) {
    checks.push(skip("hook-script", "Hook \u6CE8\u518C\u5148\u4FEE"));
    checks.push(skip("claude-md", "\u8DF3\u8FC7"));
    return finalize(checks, false);
  }
  const hookScriptCheck = checkHookScript(settingsPath);
  checks.push(hookScriptCheck);
  if (opts.fix && hookScriptCheck.status === "fail") await autoFix(hookScriptCheck, opts);
  const claudeMdPath = path14.join(cwd, "CLAUDE.md");
  const claudeMdCheck = checkClaudeMd(claudeMdPath);
  checks.push(claudeMdCheck);
  if (opts.fix && claudeMdCheck.status === "fail") await autoFix(claudeMdCheck, opts);
  return finalize(checks, false);
}
function finalize(checks, earlyExit) {
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const skipped = checks.filter((c) => c.status === "skip").length;
  return { checks, passed, failed, skipped, allPassed: failed === 0 && !earlyExit };
}
function skip(name, detail) {
  return { name, status: "skip", detail };
}
function checkNodeVersion() {
  const raw = process.version;
  const major = parseInt(raw.slice(1).split(".")[0] ?? "0", 10);
  if (major >= 22) {
    return { name: "node-version", status: "pass", detail: `${raw}  (\u9700\u8981 \u2265 22)` };
  }
  return {
    name: "node-version",
    status: "fail",
    detail: `${raw} (\u9700\u8981 \u2265 22)`,
    fix: "nvm install 22 && nvm use 22"
  };
}
function checkClaudeCode() {
  try {
    const out = execSync3("claude --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    }).trim();
    return { name: "claude-code", status: "pass", detail: out.split("\n")[0] ?? out };
  } catch {
    return {
      name: "claude-code",
      status: "fail",
      detail: "\u672A\u627E\u5230 claude \u547D\u4EE4",
      fix: "npm install -g @anthropic-ai/claude-code"
    };
  }
}
function checkSqliteVec() {
  try {
    _require("sqlite-vec");
    return { name: "sqlite-vec", status: "pass", detail: "\u52A0\u8F7D\u6210\u529F" };
  } catch {
    const here = path14.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w):/, "$1:"));
    const candidates = [
      // packages/cli/.../doctor.ts → walk up to monorepo root
      path14.resolve(here, "../../../adapters"),
      path14.resolve(here, "../../../teamagent"),
      path14.resolve(here, "../../../../adapters"),
      path14.resolve(here, "../../../../teamagent")
    ];
    for (const root of candidates) {
      try {
        _require.resolve("sqlite-vec", { paths: [root] });
        return { name: "sqlite-vec", status: "pass", detail: `\u52A0\u8F7D\u6210\u529F (resolved via ${path14.basename(root)})` };
      } catch {
      }
    }
    return {
      name: "sqlite-vec",
      status: "fail",
      detail: "sqlite-vec \u6269\u5C55\u52A0\u8F7D\u5931\u8D25",
      fix: "npm install -g sqlite-vec  \uFF08\u6216\u68C0\u67E5\u5E73\u53F0\u662F\u5426\u652F\u6301\uFF09"
    };
  }
}
function checkHomeDir(home) {
  const tDir = path14.join(home, ".teamagent");
  try {
    fs13.mkdirSync(tDir, { recursive: true });
    const probe = path14.join(tDir, `.doctor-probe-${process.pid}`);
    fs13.writeFileSync(probe, "");
    fs13.unlinkSync(probe);
    return { name: "home-dir", status: "pass", detail: `${tDir} \u53EF\u8BFB\u5199` };
  } catch (e) {
    return {
      name: "home-dir",
      status: "fail",
      detail: `~/.teamagent \u4E0D\u53EF\u5199: ${String(e).slice(0, 80)}`,
      fix: `chmod 755 ${tDir}`
    };
  }
}
function checkKnowledgeDb(dbPath) {
  if (!fs13.existsSync(dbPath)) {
    return {
      name: "knowledge-db",
      status: "fail",
      detail: "\u77E5\u8BC6\u5E93\u672A\u521D\u59CB\u5316",
      fix: "teamagent init"
    };
  }
  try {
    const db = openDb(dbPath);
    db.close();
    return { name: "knowledge-db", status: "pass", detail: dbPath };
  } catch (e) {
    return {
      name: "knowledge-db",
      status: "fail",
      detail: `knowledge.db \u65E0\u6CD5\u6253\u5F00\uFF1A${String(e).slice(0, 120)}`,
      fix: "teamagent init  \uFF08\u5C06\u91CD\u5EFA\u6570\u636E\u5E93\uFF09"
    };
  }
}
function checkHookRegistered(settingsPath) {
  if (!fs13.existsSync(settingsPath)) {
    return {
      name: "hook-registered",
      status: "fail",
      detail: ".claude/settings.local.json \u4E0D\u5B58\u5728",
      fix: "teamagent install-hook"
    };
  }
  try {
    const raw = fs13.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings["hooks"];
    const pre = hooks?.["PreToolUse"];
    const hasTeamAgent = Array.isArray(pre) && pre.some((h) => h["_teamagentTag"] === "teamagent-pre-tool-use");
    if (hasTeamAgent) {
      return { name: "hook-registered", status: "pass", detail: "PreToolUse Hook \u5DF2\u6CE8\u518C" };
    }
    return {
      name: "hook-registered",
      status: "fail",
      detail: "settings.local.json \u4E2D\u672A\u627E\u5230 TeamAgent hook",
      fix: "teamagent install-hook"
    };
  } catch {
    return {
      name: "hook-registered",
      status: "fail",
      detail: "\u65E0\u6CD5\u89E3\u6790 settings.local.json",
      fix: "teamagent install-hook"
    };
  }
}
function checkHookScript(settingsPath) {
  try {
    const raw = fs13.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings["hooks"];
    const pre = hooks?.["PreToolUse"];
    const entry = Array.isArray(pre) ? pre.find((h) => h["_teamagentTag"] === "teamagent-pre-tool-use") : void 0;
    const cmds = entry?.["hooks"];
    const cmd = cmds?.[0]?.command ?? "";
    const match = cmd.match(/node\s+"?([^"]+)"?/);
    const scriptPath = match?.[1];
    if (!scriptPath || !fs13.existsSync(scriptPath)) {
      return {
        name: "hook-script",
        status: "fail",
        detail: `Hook \u811A\u672C\u4E0D\u5B58\u5728: ${scriptPath ?? "(\u672A\u627E\u5230\u8DEF\u5F84)"}`,
        fix: "npm install -g teamagent  \uFF08\u91CD\u88C5\uFF09"
      };
    }
    return { name: "hook-script", status: "pass", detail: scriptPath };
  } catch {
    return {
      name: "hook-script",
      status: "fail",
      detail: "\u65E0\u6CD5\u8BFB\u53D6 hook \u811A\u672C\u8DEF\u5F84",
      fix: "teamagent install-hook"
    };
  }
}
function checkClaudeMd(claudeMdPath) {
  if (!fs13.existsSync(claudeMdPath)) {
    return {
      name: "claude-md",
      status: "fail",
      detail: "CLAUDE.md \u4E0D\u5B58\u5728",
      fix: "teamagent compile"
    };
  }
  const content = fs13.readFileSync(claudeMdPath, "utf-8");
  if (content.includes("TEAMAGENT:START")) {
    return { name: "claude-md", status: "pass", detail: "TEAMAGENT \u533A\u5757\u5DF2\u5B58\u5728" };
  }
  return {
    name: "claude-md",
    status: "fail",
    detail: "CLAUDE.md \u4E2D\u672A\u627E\u5230 TEAMAGENT:START \u6807\u8BB0",
    fix: "teamagent compile"
  };
}
function renderDoctorResult(result) {
  const lines = [];
  lines.push("\u73AF\u5883\u8BCA\u65AD / Environment Check");
  lines.push("\u2500".repeat(40));
  for (const check of result.checks) {
    if (check.status === "pass") {
      lines.push(`\u2705 ${check.name.padEnd(16)}  ${check.detail}`);
    } else if (check.status === "fail") {
      lines.push(`\u274C ${check.name.padEnd(16)}  ${check.detail}`);
      if (check.fix) {
        lines.push(`   \u2192 \u8FD0\u884C: ${check.fix}`);
      }
    } else {
      lines.push(`\u23ED  ${check.name.padEnd(16)}  (${check.detail})`);
    }
  }
  lines.push("");
  if (result.allPassed) {
    lines.push("\u2705 \u5168\u90E8\u68C0\u67E5\u901A\u8FC7\uFF01TeamAgent \u8FD0\u884C\u6B63\u5E38\u3002");
  } else {
    const parts = [];
    if (result.failed > 0) parts.push(`${result.failed} \u9879\u5931\u8D25`);
    if (result.skipped > 0) parts.push(`${result.skipped} \u9879\u8DF3\u8FC7`);
    lines.push(`${parts.join("\uFF0C")}\u3002\u4FEE\u590D\u540E\u91CD\u8DD1 teamagent doctor`);
  }
  return lines.join("\n") + "\n";
}

// ../cli/src/commands/scan-errors.ts
init_esm_shims();
import os12 from "os";
import path15 from "path";
import fs14 from "fs";
var SCAN_STATE_FILENAME = "scan-state.json";
function resolveSince(sinceRaw, homeDir, now) {
  if (!sinceRaw) {
    const statePath = path15.join(homeDir, ".teamagent", SCAN_STATE_FILENAME);
    try {
      const state = JSON.parse(fs14.readFileSync(statePath, "utf-8"));
      if (state.lastScanAt) return new Date(String(state.lastScanAt));
    } catch {
    }
    return new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  }
  if (/^\d+h$/.test(sinceRaw)) {
    const hours = parseInt(sinceRaw, 10);
    return new Date(now.getTime() - hours * 60 * 60 * 1e3);
  }
  const d = new Date(sinceRaw);
  if (isNaN(d.getTime())) {
    throw new Error(
      `--since \u683C\u5F0F\u65E0\u6548: "${sinceRaw}"\u3002\u63A5\u53D7\u683C\u5F0F: "24h"\uFF08\u5C0F\u65F6\uFF09\u3001"7d"\uFF08\u5929\uFF09\u6216 ISO \u65E5\u671F "2026-01-01"`
    );
  }
  return d;
}
function saveScanState(homeDir, now, mode) {
  const dir = path15.join(homeDir, ".teamagent");
  fs14.mkdirSync(dir, { recursive: true });
  fs14.writeFileSync(
    path15.join(dir, SCAN_STATE_FILENAME),
    JSON.stringify({ lastScanAt: now.toISOString(), lastScanMode: mode }, null, 2)
  );
}
function validateAndBuildEntry(raw, id, now) {
  const { category, tags, type, nature, trigger, wrong_pattern, correct_pattern, reasoning } = raw;
  if (!["C", "E", "S", "K"].includes(String(category))) return null;
  if (!["avoidance", "practice"].includes(String(type))) return null;
  if (!["objective", "subjective"].includes(String(nature))) return null;
  if (typeof trigger !== "string" || !trigger.trim()) return null;
  if (typeof correct_pattern !== "string" || !correct_pattern.trim()) return null;
  if (typeof reasoning !== "string" || !reasoning.trim()) return null;
  const ts = now.toISOString();
  return {
    id,
    scope: { level: "personal" },
    category,
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [],
    type,
    nature,
    trigger: String(trigger).trim(),
    wrong_pattern: typeof wrong_pattern === "string" ? wrong_pattern : "",
    correct_pattern: String(correct_pattern).trim(),
    reasoning: String(reasoning).trim(),
    confidence: 0.5,
    enforcement: "suggest",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: ts,
    last_hit_at: "",
    last_validated_at: ts,
    source: "accumulated",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0
  };
}
async function executeScanErrors(opts = { mode: "efficient", minFreq: 2, dryRun: false, quiet: false }) {
  const home = opts.homeDir ?? os12.homedir();
  const now = opts.now ? opts.now() : /* @__PURE__ */ new Date();
  const since = resolveSince(opts.sinceRaw, home, now);
  const projectsRoot = opts.projectsRoot ?? path15.join(home, ".claude", "projects");
  const eventsDbPath = opts.eventsDbPath ?? path15.join(home, ".teamagent", "events.db");
  const candidatesDbPath = opts.candidatesDbPath ?? path15.join(home, ".teamagent", "candidates.db");
  let events = [];
  if (fs14.existsSync(eventsDbPath)) {
    const eventLog = new SqliteEventLog(openDb(eventsDbPath));
    events = eventLog.readAll();
    eventLog.close();
  }
  const sessions = [];
  try {
    const src = new ClaudeSessionSource(projectsRoot);
    const recent = await src.listRecent(20);
    for (const meta of recent) {
      if (meta.startTime < since.toISOString()) continue;
      try {
        sessions.push(await src.loadById(meta.sessionId));
      } catch {
      }
    }
  } catch {
  }
  const collector = new CompositeErrorSignalCollector({ events, sessions, since, now });
  let signals = await collector.collect(since);
  if (opts.mode === "efficient") {
    signals = filterSignals(signals, {
      weightThreshold: 0.3,
      minSessions: opts.minFreq
    });
  }
  if (signals.length === 0) {
    if (!opts.quiet) return "\u{1F4ED} \u65E0\u65B0\u9519\u8BEF\u4FE1\u53F7\uFF0C\u77E5\u8BC6\u5E93\u65E0\u9700\u66F4\u65B0\u3002\n";
    return "";
  }
  const batches = buildErrorBatches(signals);
  const lines = [];
  lines.push(`\u{1F50D} scan-errors [${opts.mode} mode] \u2014 since ${since.toISOString()}`);
  lines.push(`  \u4FE1\u53F7\u6570: ${signals.length}\uFF0C\u6279\u6B21\u6570: ${batches.length}`);
  lines.push("");
  if (opts.dryRun) {
    for (const batch of batches) {
      lines.push(`  [dry-run] category=${batch.category} signals=${batch.signals.length}`);
      for (const s of batch.signals) {
        lines.push(
          `    - [${s.signalType}] w=${s.weight.toFixed(2)} ${s.context.slice(0, 80)}`
        );
      }
    }
    lines.push("");
    lines.push("  (dry-run \u6A21\u5F0F\uFF0C\u672A\u5199\u5165\u5019\u9009\u961F\u5217)");
    return lines.join("\n") + "\n";
  }
  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  fs14.mkdirSync(path15.dirname(candidatesDbPath), { recursive: true });
  const queueDb = openDb(candidatesDbPath);
  const queue = new SqliteCandidateQueue(queueDb);
  let totalCandidates = 0;
  for (const batch of batches) {
    let rawResponse;
    try {
      rawResponse = await llm.complete(batch.prompt);
    } catch (e) {
      lines.push(
        `  \u26A0 LLM \u8C03\u7528\u5931\u8D25 (category=${batch.category}): ${String(e).slice(0, 100)}`
      );
      continue;
    }
    let entries = [];
    try {
      const fenced = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      const json = fenced ? fenced[1].trim() : rawResponse.trim();
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) entries = parsed;
    } catch {
      lines.push(`  \u26A0 LLM \u54CD\u5E94\u89E3\u6790\u5931\u8D25 (category=${batch.category})`);
      continue;
    }
    for (const raw of entries) {
      const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
      const rand = Math.random().toString(36).slice(2, 8);
      const candidateId = `cand-${ts}-${rand}`;
      const entryId = `pers-${ts}-${rand}`;
      const entry = validateAndBuildEntry(raw, entryId, now);
      if (!entry) continue;
      const sourceDesc = batch.signals.map((s) => `${s.signalType}\xD7${s.sessionIds.length}`).join(", ");
      queue.enqueue([{ id: candidateId, entry, sourceSignals: sourceDesc }]);
      totalCandidates++;
    }
  }
  queueDb.close();
  saveScanState(home, now, opts.mode);
  if (totalCandidates > 0 && fs14.existsSync(eventsDbPath)) {
    try {
      const eventLog = new SqliteEventLog(openDb(eventsDbPath));
      const addedEvent = {
        id: `ev-cand-added-${now.getTime()}`,
        kind: "error.candidate.added",
        timestamp: now.toISOString(),
        schema_version: 1
      };
      addedEvent.count = totalCandidates;
      eventLog.append(addedEvent);
      eventLog.close();
    } catch {
    }
  }
  lines.push(`  \u2713 \u65B0\u589E\u5019\u9009\u89C4\u5219: ${totalCandidates} \u6761`);
  if (totalCandidates > 0) {
    lines.push(`  \u8FD0\u884C teamagent review-candidates \u5BA1\u6838`);
  }
  return lines.join("\n") + "\n";
}
function parseScanErrorsArgs(argv) {
  const opts = {
    mode: "efficient",
    minFreq: 2,
    dryRun: false,
    quiet: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode" && argv[i + 1]) {
      const v = argv[++i];
      if (v === "full" || v === "efficient") opts.mode = v;
      else throw new Error(`--mode \u5FC5\u987B\u662F "efficient" \u6216 "full"\uFF0C\u6536\u5230: "${v}"`);
    } else if (a.startsWith("--mode=")) {
      const v = a.slice("--mode=".length);
      if (v === "full" || v === "efficient") opts.mode = v;
      else throw new Error(`--mode \u5FC5\u987B\u662F "efficient" \u6216 "full"\uFF0C\u6536\u5230: "${v}"`);
    } else if (a === "--min-freq" && argv[i + 1]) {
      const v = parseInt(argv[++i], 10);
      if (isNaN(v)) throw new Error(`--min-freq \u5FC5\u987B\u662F\u6574\u6570\uFF0C\u6536\u5230: "${argv[i]}"`);
      opts.minFreq = v;
    } else if (a.startsWith("--min-freq=")) {
      const v = parseInt(a.slice("--min-freq=".length), 10);
      if (isNaN(v)) throw new Error(`--min-freq \u5FC5\u987B\u662F\u6574\u6570\uFF0C\u6536\u5230: "${a.slice("--min-freq=".length)}"`);
      opts.minFreq = v;
    } else if (a === "--dry-run") {
      opts.dryRun = true;
    } else if (a === "--quiet") {
      opts.quiet = true;
    } else if (a === "--since" && argv[i + 1]) {
      opts.sinceRaw = argv[++i];
    } else if (a.startsWith("--since=")) {
      opts.sinceRaw = a.slice("--since=".length);
    }
  }
  return opts;
}

// ../cli/src/commands/review-candidates.ts
init_esm_shims();
import os13 from "os";
import path16 from "path";
import fs15 from "fs";
import * as readline from "readline";
async function executeReviewCandidates(opts = {}) {
  const home = opts.homeDir ?? os13.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const candidatesDbPath = opts.candidatesDbPath ?? path16.join(home, ".teamagent", "candidates.db");
  const projectDbPath = opts.projectDbPath ?? path16.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath = opts.userGlobalDbPath ?? path16.join(home, ".teamagent", "global.db");
  const eventsDbPath = opts.eventsDbPath ?? path16.join(home, ".teamagent", "events.db");
  const claudeMdPath = opts.claudeMdPath ?? path16.join(cwd, "CLAUDE.md");
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const emitEvent = (evt) => {
    if (!fs15.existsSync(eventsDbPath)) return;
    try {
      const eventLog = new SqliteEventLog(openDb(eventsDbPath));
      eventLog.append({ ...evt, schema_version: 1 });
      eventLog.close();
    } catch {
    }
  };
  if (!fs15.existsSync(candidatesDbPath)) {
    return "\u{1F4ED} \u5019\u9009\u961F\u5217\u4E3A\u7A7A\uFF08candidates.db \u4E0D\u5B58\u5728\uFF09\u3002\u5148\u8FD0\u884C teamagent scan-errors\u3002\n";
  }
  const queueDb = openDb(candidatesDbPath);
  const queue = new SqliteCandidateQueue(queueDb);
  let pending = queue.listPending();
  if (opts.limit !== void 0) {
    pending = pending.slice(0, opts.limit);
  }
  if (pending.length === 0) {
    queueDb.close();
    return "\u2705 \u5019\u9009\u961F\u5217\u5DF2\u6E05\u7A7A\uFF0C\u65E0\u5F85\u5BA1\u6838\u6761\u76EE\u3002\n";
  }
  fs15.mkdirSync(path16.dirname(projectDbPath), { recursive: true });
  fs15.mkdirSync(path16.dirname(userGlobalDbPath), { recursive: true });
  const store = new DualLayerStore({ projectDbPath, userGlobalDbPath });
  const projectStore = store.getProjectStore();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
  process.stdout.write(`\u{1F4CB} \u5019\u9009\u89C4\u5219\u5BA1\u6838 \u2014 \u5171 ${pending.length} \u6761\u5F85\u5BA1
`);
  process.stdout.write("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
  let approved = 0;
  let rejected = 0;
  let skipped = 0;
  for (let i = 0; i < pending.length; i++) {
    const candidate = pending[i];
    const e = candidate.entry;
    process.stdout.write(`
[${i + 1}/${pending.length}] category=${e.category}  tags=[${e.tags.join(", ")}]
`);
    process.stdout.write(`  trigger:  ${e.trigger}
`);
    if (e.wrong_pattern) process.stdout.write(`  wrong:    ${e.wrong_pattern}
`);
    process.stdout.write(`  correct:  ${e.correct_pattern}
`);
    process.stdout.write(`  reason:   ${e.reasoning}
`);
    process.stdout.write(`  \u6765\u6E90\u4FE1\u53F7: ${candidate.sourceSignals}
`);
    process.stdout.write(`  confidence: ${e.confidence.toFixed(2)}
`);
    process.stdout.write("\n  [a]pprove  [r]eject  [s]kip  [q]uit\n");
    const answer = (await ask("> ")).trim().toLowerCase();
    if (answer === "q") {
      process.stdout.write("\n\u9000\u51FA\u5BA1\u6838\uFF0C\u5269\u4F59\u6761\u76EE\u4FDD\u7559\u5728\u961F\u5217\u4E2D\u3002\n");
      break;
    }
    if (answer === "a") {
      try {
        projectStore.add(e);
        queue.updateStatus(candidate.id, "approved");
        approved++;
        process.stdout.write(`\u2713 \u5DF2\u5199\u5165\u77E5\u8BC6\u5E93 (id: ${e.id})
`);
        emitEvent({
          id: `ev-cand-approved-${now().getTime()}-${candidate.id.slice(-6)}`,
          kind: "error.candidate.approved",
          knowledge_id: e.id,
          timestamp: now().toISOString()
        });
      } catch (err) {
        process.stdout.write(`\u26A0 \u5199\u5165\u5931\u8D25: ${String(err).slice(0, 100)}
`);
      }
    } else if (answer === "r") {
      queue.updateStatus(candidate.id, "rejected");
      rejected++;
      process.stdout.write("\u2717 \u5DF2\u62D2\u7EDD\n");
      emitEvent({
        id: `ev-cand-rejected-${now().getTime()}-${candidate.id.slice(-6)}`,
        kind: "error.candidate.rejected",
        timestamp: now().toISOString()
      });
    } else {
      queue.updateStatus(candidate.id, "skipped");
      skipped++;
      process.stdout.write("\u2192 \u5DF2\u8DF3\u8FC7\uFF08\u4E0B\u6B21\u5BA1\u6838\u53EF\u89C1\uFF09\n");
    }
  }
  rl.close();
  if (approved > 0) {
    process.stdout.write("\n\u91CD\u65B0\u6821\u51C6 + \u7F16\u8BD1 CLAUDE.md\u2026\n");
    try {
      await runCalibrationPipeline({
        calibrator: defaultCalibrator,
        store: projectStore,
        events: [],
        now
      });
      const mdCompiler = new MarkdownCompiler(claudeMdPath, () => now().toISOString());
      await runCompile({
        store,
        markdownCompiler: mdCompiler,
        skillCompiler: makeSkillCompiler()
      });
      process.stdout.write("\u2713 CLAUDE.md \u5DF2\u66F4\u65B0\n");
    } catch (err) {
      process.stdout.write(`\u26A0 \u6821\u51C6/\u7F16\u8BD1\u5931\u8D25: ${String(err).slice(0, 100)}
`);
    }
  }
  store.close();
  queueDb.close();
  return `
\u5BA1\u6838\u5B8C\u6210: \u2713\u6279\u51C6 ${approved}  \u2717\u62D2\u7EDD ${rejected}  \u2192\u8DF3\u8FC7 ${skipped}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
}
function parseReviewCandidatesArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) {
      opts.limit = parseInt(argv[++i], 10);
    } else if (a.startsWith("--limit=")) {
      opts.limit = parseInt(a.slice("--limit=".length), 10);
    }
  }
  return opts;
}

// ../cli/src/commands/pair.ts
init_esm_shims();
import fs16 from "fs";
import os14 from "os";
import path17 from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
function executePairCapsule(opts) {
  if (!opts.name.trim()) throw new Error("--name is required");
  if (!opts.host.trim()) throw new Error("--host is required");
  const homeDir = opts.homeDir ?? os14.homedir();
  const user = opts.user ?? os14.userInfo().username;
  const port = opts.port ?? 22;
  const createdAt = opts.now?.() ?? (/* @__PURE__ */ new Date()).toISOString();
  const ttlMinutes = opts.ttlMinutes ?? 30;
  const expiresAt = new Date(Date.parse(createdAt) + ttlMinutes * 6e4).toISOString();
  const nonce = opts.nonce ?? crypto.randomBytes(16).toString("hex");
  const publicKey = opts.publicKey ?? readDefaultPublicKey(homeDir, opts.publicKeyPath);
  const publicKeyFingerprint = fingerprintPublicKey(publicKey);
  const hostAlias = `teamagent-${slugify(opts.name)}`;
  const id = `tap_${sha256Hex([
    opts.name,
    opts.host,
    user,
    String(port),
    publicKeyFingerprint,
    nonce
  ].join("|")).slice(0, 16)}`;
  const capsule = {
    version: 1,
    kind: "teamagent.pair.capsule",
    peer: {
      id,
      name: opts.name,
      hostAlias,
      host: opts.host,
      user,
      port,
      publicKeyFingerprint
    },
    createdAt,
    expiresAt,
    nonce
  };
  const token = `tap1.${base64UrlEncode(JSON.stringify(capsule))}`;
  if (opts.out) {
    fs16.mkdirSync(path17.dirname(opts.out), { recursive: true });
    fs16.writeFileSync(opts.out, JSON.stringify({ capsule, token }, null, 2) + "\n");
  }
  return { capsule, token, ...opts.out ? { outPath: opts.out } : {} };
}
function executePairAccept(opts) {
  const homeDir = opts.homeDir ?? os14.homedir();
  const sshConfigPath = opts.sshConfigPath ?? path17.join(homeDir, ".ssh", "config");
  const now = opts.now?.() ?? (/* @__PURE__ */ new Date()).toISOString();
  const capsule = decodeCapsule(opts.capsule);
  ensureCapsuleFresh(capsule, now);
  const peer = {
    ...capsule.peer,
    acceptedAt: now,
    capsuleNonce: capsule.nonce,
    source: "capsule"
  };
  const pairDir = path17.join(homeDir, ".teamagent", "pairing");
  const receiptDir = path17.join(pairDir, "receipts");
  const peerBookPath = path17.join(pairDir, "peers.json");
  const receiptPath = path17.join(receiptDir, `${slugify(peer.name)}.json`);
  const changed = [];
  const currentBook = readPeerBook(peerBookPath);
  const nextBook = upsertPeer(currentBook, peer);
  const nextBookText = JSON.stringify(nextBook, null, 2) + "\n";
  const oldBookText = fs16.existsSync(peerBookPath) ? fs16.readFileSync(peerBookPath, "utf-8") : "";
  if (oldBookText !== nextBookText) changed.push(peerBookPath);
  const receipt = {
    version: 1,
    kind: "teamagent.pair.receipt",
    localName: opts.localName ?? os14.hostname(),
    acceptedAt: now,
    peer
  };
  const nextReceiptText = JSON.stringify(receipt, null, 2) + "\n";
  const oldReceiptText = fs16.existsSync(receiptPath) ? fs16.readFileSync(receiptPath, "utf-8") : "";
  if (oldReceiptText !== nextReceiptText) changed.push(receiptPath);
  const nextSshConfig = renderManagedSshConfig(
    fs16.existsSync(sshConfigPath) ? fs16.readFileSync(sshConfigPath, "utf-8") : "",
    peer
  );
  const oldSshConfig = fs16.existsSync(sshConfigPath) ? fs16.readFileSync(sshConfigPath, "utf-8") : "";
  if (oldSshConfig !== nextSshConfig) changed.push(sshConfigPath);
  if (!opts.dryRun) {
    fs16.mkdirSync(pairDir, { recursive: true });
    fs16.mkdirSync(receiptDir, { recursive: true });
    fs16.mkdirSync(path17.dirname(sshConfigPath), { recursive: true });
    fs16.writeFileSync(peerBookPath, nextBookText);
    fs16.writeFileSync(receiptPath, nextReceiptText);
    fs16.writeFileSync(sshConfigPath, nextSshConfig);
  }
  return {
    ok: true,
    peer,
    files: { peerBookPath, receiptPath, sshConfigPath },
    changed,
    dryRun: opts.dryRun ?? false
  };
}
function executePairKnock(opts) {
  const homeDir = opts.homeDir ?? os14.homedir();
  const sshConfigPath = opts.sshConfigPath ?? path17.join(homeDir, ".ssh", "config");
  const peerBook = readPeerBook(path17.join(homeDir, ".teamagent", "pairing", "peers.json"));
  const peer = peerBook.peers.find((p) => p.name === opts.peer || p.id === opts.peer || p.hostAlias === opts.peer);
  if (!peer) {
    return {
      ok: false,
      peer: opts.peer,
      command: [],
      stdout: "",
      stderr: `unknown peer: ${opts.peer}`,
      exitCode: 2
    };
  }
  const expected = `teamagent-pair-ok:${peer.id}`;
  const command = ["ssh", "-F", sshConfigPath, peer.hostAlias, "printf", "%s\\\\n", expected];
  if (opts.simulate) {
    return {
      ok: true,
      peer: peer.name,
      peerId: peer.id,
      hostAlias: peer.hostAlias,
      command,
      stdout: `${expected}
`,
      stderr: "",
      exitCode: 0
    };
  }
  const runner = opts.runner ?? defaultSshRunner;
  const result = runner(command.slice(1));
  const ok = result.exitCode === 0 && result.stdout.trim() === expected;
  return {
    ok,
    peer: peer.name,
    peerId: peer.id,
    hostAlias: peer.hostAlias,
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode
  };
}
function executePairList(opts = {}) {
  const homeDir = opts.homeDir ?? os14.homedir();
  return readPeerBook(path17.join(homeDir, ".teamagent", "pairing", "peers.json"));
}
function renderPairCapsuleResult(result) {
  const lines = [
    `\u63E1\u624B\u80F6\u56CA\u5DF2\u751F\u6210: ${result.capsule.peer.name} (${result.capsule.peer.hostAlias})`,
    `peer id: ${result.capsule.peer.id}`,
    `fingerprint: ${result.capsule.peer.publicKeyFingerprint}`,
    `expires: ${result.capsule.expiresAt}`
  ];
  if (result.outPath) lines.push(`\u6587\u4EF6: ${result.outPath}`);
  lines.push(`token: ${result.token}`);
  return lines.join("\n") + "\n";
}
function renderPairAcceptResult(result) {
  const changed = result.changed.length === 0 ? "\u65E0\u53D8\u5316" : `${result.changed.length} \u4E2A\u6587\u4EF6\u5DF2\u66F4\u65B0`;
  return [
    `\u5DF2\u63A5\u53D7 ${result.peer.name} \u7684\u63E1\u624B\u80F6\u56CA`,
    `host: ${result.peer.hostAlias} -> ${result.peer.user}@${result.peer.host}:${result.peer.port}`,
    `fingerprint: ${result.peer.publicKeyFingerprint}`,
    changed
  ].join("\n") + "\n";
}
function renderPairKnockResult(result) {
  if (result.ok) {
    return `SSH knock \u6210\u529F: ${result.peer} (${result.hostAlias})
${result.stdout}`;
  }
  return `SSH knock \u5931\u8D25: ${result.peer}
exit=${result.exitCode}
${result.stderr}`;
}
function renderPairList(book) {
  if (book.peers.length === 0) return "\u5C1A\u672A\u914D\u5BF9\u4EFB\u4F55 teammate\n";
  return book.peers.map((p) => `${p.name}	${p.hostAlias}	${p.user}@${p.host}:${p.port}	${p.publicKeyFingerprint}`).join("\n") + "\n";
}
function parsePairArgs(argv) {
  const sub = argv[0];
  if (!sub || !["capsule", "accept", "knock", "list"].includes(sub)) {
    throw new Error("Usage: teamagent pair <capsule|accept|knock|list> ...");
  }
  const rest = argv.slice(1);
  const flags = parseFlags(rest);
  if (sub === "capsule") {
    const now = stringFlag(flags, "now");
    return {
      subcommand: sub,
      options: {
        name: stringFlag(flags, "name", true),
        host: stringFlag(flags, "host", true),
        user: stringFlag(flags, "user"),
        port: numberFlag(flags, "port"),
        publicKey: stringFlag(flags, "public-key"),
        publicKeyPath: stringFlag(flags, "public-key-path"),
        homeDir: stringFlag(flags, "home-dir"),
        out: stringFlag(flags, "out"),
        ttlMinutes: numberFlag(flags, "ttl-minutes"),
        nonce: stringFlag(flags, "nonce"),
        ...now ? { now: () => now } : {}
      }
    };
  }
  if (sub === "accept") {
    const capsule = flags.positionals[0];
    if (!capsule) throw new Error("Usage: teamagent pair accept <capsule-file|token|json>");
    const now = stringFlag(flags, "now");
    return {
      subcommand: sub,
      options: {
        capsule,
        homeDir: stringFlag(flags, "home-dir"),
        sshConfigPath: stringFlag(flags, "ssh-config"),
        localName: stringFlag(flags, "local-name"),
        dryRun: booleanFlag(flags, "dry-run"),
        ...now ? { now: () => now } : {}
      }
    };
  }
  if (sub === "knock") {
    const peer = flags.positionals[0];
    if (!peer) throw new Error("Usage: teamagent pair knock <peer>");
    return {
      subcommand: sub,
      options: {
        peer,
        homeDir: stringFlag(flags, "home-dir"),
        sshConfigPath: stringFlag(flags, "ssh-config"),
        json: booleanFlag(flags, "json"),
        simulate: booleanFlag(flags, "simulate")
      }
    };
  }
  return {
    subcommand: sub,
    options: {
      homeDir: stringFlag(flags, "home-dir"),
      json: booleanFlag(flags, "json")
    }
  };
}
function defaultSshRunner(args) {
  const proc = spawnSync("ssh", args, { encoding: "utf-8", timeout: 1e4 });
  return {
    exitCode: proc.status ?? 124,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? (proc.error ? String(proc.error) : "")
  };
}
function readDefaultPublicKey(homeDir, explicitPath) {
  const candidates = explicitPath ? [explicitPath] : ["id_ed25519.pub", "id_rsa.pub", "id_ecdsa.pub"].map((f) => path17.join(homeDir, ".ssh", f));
  for (const candidate of candidates) {
    if (fs16.existsSync(candidate)) {
      const text = fs16.readFileSync(candidate, "utf-8").trim();
      if (text) return text;
    }
  }
  throw new Error("No SSH public key found. Pass --public-key or --public-key-path.");
}
function fingerprintPublicKey(publicKey) {
  const parts = publicKey.trim().split(/\s+/);
  if (parts.length >= 2 && parts[1]) {
    try {
      const digest = crypto.createHash("sha256").update(Buffer.from(parts[1], "base64")).digest("base64");
      return `SHA256:${digest.replace(/=+$/, "")}`;
    } catch {
    }
  }
  return `SHA256:${crypto.createHash("sha256").update(publicKey).digest("base64").replace(/=+$/, "")}`;
}
function decodeCapsule(input) {
  let text = input.trim();
  if (fs16.existsSync(text)) {
    text = fs16.readFileSync(text, "utf-8").trim();
  }
  if (text.startsWith("tap1.")) {
    text = Buffer.from(text.slice("tap1.".length), "base64url").toString("utf-8");
  }
  const parsed = JSON.parse(text);
  const capsule = "capsule" in parsed && parsed.capsule ? parsed.capsule : parsed;
  if (capsule.version !== 1 || capsule.kind !== "teamagent.pair.capsule") {
    throw new Error("Invalid TeamAgent pairing capsule");
  }
  return capsule;
}
function ensureCapsuleFresh(capsule, now) {
  if (Date.parse(now) > Date.parse(capsule.expiresAt)) {
    throw new Error(`Pairing capsule expired at ${capsule.expiresAt}`);
  }
}
function readPeerBook(peerBookPath) {
  if (!fs16.existsSync(peerBookPath)) return { version: 1, peers: [] };
  const parsed = JSON.parse(fs16.readFileSync(peerBookPath, "utf-8"));
  if (parsed.version !== 1 || !Array.isArray(parsed.peers)) return { version: 1, peers: [] };
  return parsed;
}
function upsertPeer(book, peer) {
  const peers = book.peers.filter((p) => p.id !== peer.id && p.name !== peer.name && p.hostAlias !== peer.hostAlias);
  peers.push(peer);
  peers.sort((a, b) => a.name.localeCompare(b.name));
  return { version: 1, peers };
}
function renderManagedSshConfig(current, peer) {
  const start = `# >>> teamagent peer:${peer.id}`;
  const end = `# <<< teamagent peer:${peer.id}`;
  const block = [
    start,
    `Host ${peer.hostAlias}`,
    `  HostName ${peer.host}`,
    `  User ${peer.user}`,
    `  Port ${peer.port}`,
    "  IdentitiesOnly yes",
    "  StrictHostKeyChecking accept-new",
    "  UserKnownHostsFile ~/.ssh/known_hosts",
    `  # TeamAgent-Peer-Fingerprint ${peer.publicKeyFingerprint}`,
    end
  ].join("\n");
  const re = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, "m");
  const trimmed = current.endsWith("\n") || current.length === 0 ? current : `${current}
`;
  if (re.test(trimmed)) return trimmed.replace(re, `${block}
`);
  return `${trimmed}${trimmed.length > 0 && !trimmed.endsWith("\n\n") ? "\n" : ""}${block}
`;
}
function parseFlags(argv) {
  const values = /* @__PURE__ */ new Map();
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1));
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      i++;
    } else {
      values.set(key, true);
    }
  }
  return { positionals, values };
}
function stringFlag(flags, key, required) {
  const v = flags.values.get(key);
  if (v === true || v === void 0) {
    if (required) throw new Error(`--${key} is required`);
    return void 0;
  }
  return v;
}
function numberFlag(flags, key) {
  const raw = stringFlag(flags, key);
  if (raw === void 0) return void 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${key} must be a positive number`);
  return n;
}
function booleanFlag(flags, key) {
  return flags.values.get(key) === true;
}
function slugify(input) {
  const slug = input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "peer";
}
function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function base64UrlEncode(input) {
  return Buffer.from(input, "utf-8").toString("base64url");
}
function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ../cli/src/bin.ts
function findPackageVersion() {
  let dir = path18.dirname(fileURLToPath2(import.meta.url));
  let workspaceRoot = null;
  for (let i = 0; i < 8; i++) {
    if (!workspaceRoot && (fs17.existsSync(path18.join(dir, "pnpm-workspace.yaml")) || fs17.existsSync(path18.join(dir, "packages", "teamagent", "package.json")))) {
      workspaceRoot = dir;
    }
    const pkgPath = path18.join(dir, "package.json");
    if (fs17.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs17.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "teamagent" && pkg.bin?.["teamagent"] && pkg.version) {
          return pkg.version;
        }
      } catch {
      }
    }
    const next = path18.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  if (workspaceRoot) {
    try {
      const tpkgPath = path18.join(workspaceRoot, "packages", "teamagent", "package.json");
      const tpkg = JSON.parse(fs17.readFileSync(tpkgPath, "utf-8"));
      if (tpkg.version) return tpkg.version;
    } catch {
    }
  }
  return "unknown";
}
async function main() {
  const command = process.argv[2];
  const rest = process.argv.slice(3);
  switch (command) {
    case "--version":
    case "-V":
    case "version": {
      process.stdout.write(`${findPackageVersion()}
`);
      return;
    }
    case "skeleton-demo": {
      const output = await runSkeletonDemo();
      if (output) process.stdout.write(output + "\n");
      return;
    }
    case "pitfall": {
      let nonInteractive;
      try {
        nonInteractive = parsePitfallArgs(rest);
      } catch (err) {
        const { PitfallValidationError } = await import("./pitfall-QPH2WCBT.js");
        if (err instanceof PitfallValidationError) {
          process.stderr.write(err.message + "\n");
          process.exit(2);
        }
        throw err;
      }
      const output = nonInteractive ? await executePitfall(nonInteractive) : await runPitfallInteractive();
      if (output) process.stdout.write(output + "\n");
      return;
    }
    case "stats": {
      const statsOpts = {};
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--stuck-in-promotion") {
          statsOpts.stuckInPromotion = true;
        } else if (a === "--explain" && rest[i + 1]) {
          statsOpts.explain = rest[++i];
        } else if (a.startsWith("--explain=")) {
          statsOpts.explain = a.slice("--explain=".length);
        } else if (a.startsWith("--stuck-days=")) {
          const v = parseInt(a.slice("--stuck-days=".length), 10);
          if (isNaN(v) || v < 0) {
            process.stderr.write(`--stuck-days \u5FC5\u987B\u662F\u6B63\u6574\u6570\uFF0C\u6536\u5230: "${a.slice("--stuck-days=".length)}"
`);
            process.exit(1);
          }
          statsOpts.stuckDays = v;
        } else if (a === "--override-signals") {
          statsOpts.overrideSignals = true;
        }
      }
      process.stdout.write(executeStats(statsOpts));
      return;
    }
    case "demo": {
      const sub = rest[0];
      if (sub === "hook") {
        const opts = parseDemoHookArgs(rest.slice(1));
        if (!opts) {
          process.stderr.write(
            "\u7528\u6CD5: teamagent demo hook <tool> <key=value>... \u4F8B: teamagent demo hook Bash 'command=npm install moment'\n"
          );
          process.exit(1);
        }
        process.stdout.write(executeDemoHook(opts));
        return;
      }
      process.stderr.write(`\u672A\u77E5 demo \u5B50\u547D\u4EE4: ${sub}
`);
      process.exit(1);
      return;
    }
    case "install-hook": {
      const r = installHook();
      if (r.alreadyInstalled) {
        process.stdout.write(
          `\u2713 Hook \u5DF2\u5B89\u88C5\uFF08\u65E0\u53D8\u5316\uFF09: ${r.settingsPath}
  \u5165\u53E3: ${r.hookEntry}
`
        );
      } else {
        process.stdout.write(
          `\u2705 Hook \u5DF2\u6CE8\u518C\u5230 Claude Code: ${r.settingsPath}
  \u5165\u53E3: ${r.hookEntry}
  \u4E0B\u6B21\u5F00 Claude Code \u65F6\u751F\u6548\u3002\u53EF\u7528 'teamagent demo hook ...' \u79BB\u7EBF\u6D4B\u8BD5\u3002
`
        );
      }
      return;
    }
    case "uninstall-hook": {
      const r = uninstallHook();
      if (r.removed) {
        process.stdout.write(`\u2705 Hook \u5DF2\u79FB\u9664: ${r.settingsPath}
`);
      } else {
        process.stdout.write(`\u672A\u627E\u5230 TeamAgent hook \u6CE8\u518C\u3002\u65E0\u9700\u79FB\u9664\u3002
`);
      }
      return;
    }
    case "install-user-hook": {
      if (rest.includes("--dry-run")) {
        process.stderr.write(
          `install-user-hook \u4E0D\u652F\u6301 --dry-run\uFF08\u8BE5\u547D\u4EE4\u76F4\u63A5\u4FEE\u6539 ~/.claude/settings.json\uFF09\u3002
\u5982\u9700\u67E5\u770B\u6CE8\u518C\u8DEF\u5F84\uFF0C\u5148\u8FD0\u884C: teamagent install-user-hook \u540E\u7528 cat ~/.claude/settings.json \u67E5\u770B\uFF0C\u6216\u7528 teamagent uninstall-user-hook \u64A4\u9500\u3002
`
        );
        process.exit(2);
      }
      const r = installUserHook();
      if (r.alreadyInstalled) {
        process.stdout.write(
          `\u2713 \u7528\u6237\u7EA7 SessionStart hook \u5DF2\u5B89\u88C5 (\u65E0\u53D8\u5316): ${r.settingsPath}
`
        );
      } else {
        process.stdout.write(
          `\u2705 \u7528\u6237\u7EA7 SessionStart hook \u5DF2\u6CE8\u518C: ${r.settingsPath}
` + (r.backupPath ? `   \u539F\u914D\u7F6E\u5DF2\u5907\u4EFD: ${r.backupPath}
` : "") + `   \u5165\u53E3: ${r.hookEntry}
   \u6253\u5F00\u4EFB\u4F55\u65B0\u9879\u76EE\u65F6\u5C06\u81EA\u52A8\u68C0\u6D4B\u5E76 init
`
        );
      }
      return;
    }
    case "uninstall-user-hook": {
      if (rest.includes("--dry-run")) {
        process.stderr.write(
          `uninstall-user-hook \u4E0D\u652F\u6301 --dry-run\uFF08\u8BE5\u547D\u4EE4\u76F4\u63A5\u4FEE\u6539 ~/.claude/settings.json\uFF09\u3002
`
        );
        process.exit(2);
      }
      const r = uninstallUserHook();
      if (r.removed) {
        process.stdout.write(`\u2705 \u7528\u6237\u7EA7 SessionStart hook \u5DF2\u79FB\u9664: ${r.settingsPath}
`);
      } else {
        process.stdout.write(`\u672A\u627E\u5230\u7528\u6237\u7EA7 SessionStart hook\uFF0C\u65E0\u9700\u79FB\u9664
`);
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
        process.stdout.write(`\u2713 Hook \u5DF2\u7981\u7528: ${r.settingsPath}
  \u6570\u636E\u4FDD\u7559\uFF1B\u7528 'teamagent enable' \u6062\u590D
`);
      } else {
        process.stdout.write(`\u672A\u627E\u5230\u5DF2\u6CE8\u518C\u7684 TeamAgent hook\uFF0C\u65E0\u9700\u7981\u7528
`);
      }
      return;
    }
    case "enable": {
      const r = enable();
      if (r.alreadyInstalled) {
        process.stdout.write(`\u2713 Hook \u5DF2\u542F\u7528\uFF08\u65E0\u53D8\u5316\uFF09: ${r.settingsPath}
`);
      } else {
        process.stdout.write(`\u2705 Hook \u5DF2\u91CD\u65B0\u542F\u7528: ${r.settingsPath}
  \u4E0B\u6B21\u5F00 Claude Code \u65F6\u751F\u6548
`);
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
        process.stdout.write(`
\u{1F4C4} \u8BE6\u7EC6\u62A5\u544A: ${reportPath}
`);
      }
      if (result.passed !== result.total) process.exit(1);
      return;
    }
    case "e2e-evaluate": {
      const opts = parseE2EEvaluateArgs(rest);
      const result = await executeE2EEvaluate(opts);
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(renderE2EEvaluateResult(result));
      }
      if (!result.ok) process.exit(1);
      return;
    }
    case "ingest": {
      let opts;
      try {
        opts = parseIngestArgs(rest);
      } catch (err) {
        process.stderr.write(
          `${err instanceof Error ? err.message : String(err)}
`
        );
        process.exit(1);
        return;
      }
      const output = await executeIngest(opts);
      if (output.startsWith("\u2717")) {
        process.stderr.write(output);
        process.exit(1);
        return;
      }
      process.stdout.write(output);
      return;
    }
    case "dogfood-report": {
      const opts = parseDogfoodReportArgs(rest);
      const r = await executeDogfoodReport(opts);
      process.stdout.write(
        `\u{1F4CA} \u81EA\u4E3E\u62A5\u544A\u751F\u6210: ${r.outputPath}
  ${r.totalEntries} \u6761\u77E5\u8BC6 / ${r.totalEvents} \u4E2A\u4E8B\u4EF6 / ${r.archivedCount} \u81EA\u52A8\u5F52\u6863
`
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
      if (!sub || sub !== "show" && sub !== "stop-mode") {
        console.error("Usage: teamagent config stop-mode <sync|async>");
        console.error("       teamagent config show");
        process.exit(1);
      }
      try {
        const out = executeConfig({ subcommand: sub, value: val });
        console.log(out);
      } catch (e) {
        console.error(String(e));
        process.exit(1);
      }
      break;
    }
    case "migrate-v6": {
      const dryRun = rest.includes("--dry-run");
      const fast = rest.includes("--fast");
      const repairAll = rest.includes("--repair-all");
      const limitArg = rest.find((a) => a.startsWith("--limit="));
      const limit = limitArg ? Number(limitArg.split("=")[1]) : void 0;
      const dbArg = rest.find((a) => a.startsWith("--db="));
      const dbPath = dbArg ? dbArg.split("=").slice(1).join("=") : void 0;
      const { executeMigrateV6 } = await import("./migrate-v6-UUVKS2Y5.js");
      const result = await executeMigrateV6({ dryRun, dbPath, limit, fast, repairAll });
      process.stdout.write(`migrated=${result.migrated} resurrected=${result.resurrected} skipped=${result.skipped}
`);
      return;
    }
    case "migrate-v7": {
      const dryRun = rest.includes("--dry-run");
      const limitArg = rest.find((a) => a.startsWith("--limit="));
      const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : void 0;
      const dbArg = rest.find((a) => a.startsWith("--db="));
      const dbPath = dbArg ? dbArg.split("=").slice(1).join("=") : void 0;
      const { executeMigrateV7 } = await import("./migrate-v7-NTGA5GIH.js");
      await executeMigrateV7({ dryRun, dbPath, limit, cwd: process.cwd() });
      return;
    }
    case "migrate": {
      const dryRun = rest.includes("--dry-run");
      const { executeMigrate } = await import("./migrate-v1-to-v2-JWE5C5GL.js");
      const r = await executeMigrate({ dryRun });
      process.stdout.write(`Phase 1 \u2192 v2 \u8FC1\u79FB:
`);
      process.stdout.write(`  \u8BFB\u53D6\u6761\u76EE: ${r.readEntries}
`);
      process.stdout.write(`    personal: ${r.byScope.personal}
`);
      process.stdout.write(`    team \u2192 personal: ${r.byScope.team}
`);
      process.stdout.write(`    global: ${r.byScope.global}
`);
      if (dryRun) {
        process.stdout.write(`
(dry-run \u6A21\u5F0F\uFF0C\u672A\u5199\u5165 SQLite)
`);
      } else {
        process.stdout.write(`  \u5199\u5165: ${r.written} \u6761; \u62D2\u7EDD: ${r.rejected} \u6761
`);
        if (r.rejectionLog.length > 0) {
          for (const entry of r.rejectionLog) {
            process.stderr.write(`  rejected ${entry.id}: ${entry.reason}
`);
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
    case "warmup": {
      const { runWarmup } = await import("./warmup-5BRQTZU6.js");
      const result = await runWarmup();
      process.exit(result.ok ? 0 : 1);
    }
    case "migrate-auto": {
      const { runMigrateAuto } = await import("./migrate-auto-67BKCV2B.js");
      const r = await runMigrateAuto();
      process.stderr.write(JSON.stringify(r, null, 2) + "\n");
      process.exit(r.ok ? 0 : 1);
    }
    case "update": {
      const { runUpdateCommand, parseUpdateArgs } = await import("./update-KGCHSQDS.js");
      const { sub, rest: subRest } = parseUpdateArgs(rest);
      const r = await runUpdateCommand(sub, subRest);
      process.stdout.write(r.output);
      process.exit(r.ok ? 0 : 1);
    }
    case "pair": {
      const parsed = parsePairArgs(rest);
      if (parsed.subcommand === "capsule") {
        const result = executePairCapsule(parsed.options);
        process.stdout.write(renderPairCapsuleResult(result));
        return;
      }
      if (parsed.subcommand === "accept") {
        const result = executePairAccept(parsed.options);
        process.stdout.write(renderPairAcceptResult(result));
        return;
      }
      if (parsed.subcommand === "knock") {
        const opts = parsed.options;
        const result = executePairKnock(opts);
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(renderPairKnockResult(result));
        }
        if (!result.ok) process.exit(1);
        return;
      }
      const book = executePairList(parsed.options);
      if (parsed.options.json) {
        process.stdout.write(JSON.stringify(book, null, 2) + "\n");
      } else {
        process.stdout.write(renderPairList(book));
      }
      return;
    }
    case "reclassify": {
      const sub = rest[0];
      const subArgs = rest.slice(1);
      const { runReclassifyApply, runReclassifyRollback } = await import("./reclassify-MZ2VEN5I.js");
      if (sub === "apply") {
        const planIdx = subArgs.findIndex((a) => a === "--plan");
        const planFile = planIdx >= 0 ? subArgs[planIdx + 1] : void 0;
        if (!planFile) {
          process.stderr.write("Usage: teamagent reclassify apply --plan <path> [--dry-run] [--min-conf=0.7]\n");
          process.exit(1);
        }
        const dryRun = subArgs.includes("--dry-run");
        const minConfArg = subArgs.find((a) => a.startsWith("--min-conf="));
        const minConfidence = minConfArg ? parseFloat(minConfArg.split("=")[1]) : 0.7;
        runReclassifyApply({ plan: planFile, dryRun, minConfidence });
        return;
      }
      if (sub === "rollback") {
        const auditIdx = subArgs.findIndex((a) => a === "--audit");
        const auditId = auditIdx >= 0 ? subArgs[auditIdx + 1] : void 0;
        if (!auditId) {
          process.stderr.write("Usage: teamagent reclassify rollback --audit <audit-id>\n");
          process.exit(1);
        }
        runReclassifyRollback({ auditId });
        return;
      }
      process.stderr.write(
        "Usage:\n  teamagent reclassify apply --plan <path> [--dry-run] [--min-conf=0.7]\n  teamagent reclassify rollback --audit <audit-id>\n"
      );
      process.exit(1);
      return;
    }
    case void 0:
    case "--help":
    case "-h":
    case "help": {
      process.stdout.write(
        [
          "teamagent \u2014 TeamAgent CLI",
          "",
          "\u7528\u6CD5:",
          "  teamagent skeleton-demo          M0 Walking Skeleton \u6F14\u793A",
          "  teamagent pitfall                \u624B\u52A8\u8BB0\u5F55\u4E00\u6761\u8E29\u5751\u7ECF\u9A8C (\u4EA4\u4E92)",
          "  teamagent pitfall --non-interactive --trigger=... --wrong=... --correct=... --reason=...",
          "                                   \u975E\u4EA4\u4E92\u6A21\u5F0F (\u53EF\u9009: --category=C|E|S|K --tags=a,b --level=personal|team|global --nature=objective|subjective)",
          "  teamagent stats [--stuck-in-promotion] [--stuck-days=N] [--explain=<id>]",
          "                                   \u5C55\u793A\u77E5\u8BC6\u5E93\u7EDF\u8BA1\uFF1B--stuck-in-promotion \u5217\u51FA\u5361\u5728 probation \u8D85 N \u5929\u7684\u89C4\u5219",
          "  teamagent demo hook <tool> <k=v>...",
          "                                   \u79BB\u7EBF\u6A21\u62DF PreToolUse hook (\u4F8B: teamagent demo hook Bash 'command=npm install moment')",
          "  teamagent install-hook           \u628A PreToolUse hook \u6CE8\u518C\u5230\u5F53\u524D\u9879\u76EE .claude/settings.local.json",
          "  teamagent uninstall-hook         \u79FB\u9664 PreToolUse hook \u6CE8\u518C",
          "  teamagent install-user-hook      \u628A SessionStart hook \u6CE8\u518C\u5230 ~/.claude/settings.json",
          "                                   (\u6253\u5F00\u4EFB\u4F55\u65B0\u9879\u76EE\u65F6\u81EA\u52A8 init, \u4E00\u6B21\u88C5\u6C38\u4E45\u751F\u6548)",
          "  teamagent uninstall-user-hook    \u79FB\u9664\u7528\u6237\u7EA7 SessionStart hook \u6CE8\u518C",
          "  teamagent analyze [--session=<id|path>] [--verbose] [--commit]",
          "                                   \u5206\u6790 Claude Code \u4F1A\u8BDD\u65E5\u5FD7\uFF0C\u8BC6\u522B\u7EA0\u6B63\u65F6\u523B+\u6210\u529F\u4FE1\u53F7",
          "                                   --commit: \u901A\u8FC7 LLM \u63D0\u53D6\u6210\u77E5\u8BC6\u6761\u76EE\u5E76\u5199\u5165\u77E5\u8BC6\u5E93 + \u91CD\u7F16\u8BD1 CLAUDE.md",
          "  teamagent review [N] [--scope=personal|team|global]",
          "                                   \u5217\u51FA\u6700\u8FD1 N \u6761\u77E5\u8BC6\uFF08\u9ED8\u8BA4 10\uFF09\uFF0C\u4F9B\u4EBA\u5DE5\u590D\u6838",
          "  teamagent init [--dry-run] [--skip-import] [--skip-hook] [--install-plugins]",
          "                                   \u4E00\u952E\u5B89\u88C5\u5230\u5F53\u524D\u9879\u76EE\uFF1A\u5EFA\u76EE\u5F55 + \u6CE8\u5165\u5143\u539F\u5219 + \u5BFC\u5165\u5DF2\u6709\u89C4\u5219 + \u6CE8\u518C Hook + \u7F16\u8BD1 CLAUDE.md",
          "                                   --install-plugins: \u540C\u65F6\u6CE8\u518C\u56E2\u961F\u6807\u914D\u63D2\u4EF6\uFF08opt-in\uFF0C\u6539\u5199\u7528\u6237\u5168\u5C40 settings\uFF09",
          "  teamagent doctor [--fix] [--json]",
          "                                   \u8BCA\u65AD\u5B89\u88C5\u73AF\u5883\uFF08Node\u7248\u672C/Claude Code/sqlite-vec/Hook/CLAUDE.md\uFF09",
          "                                   --fix: \u81EA\u52A8\u4FEE\u590D\u80FD\u81EA\u52A8\u4FEE\u7684\u95EE\u9898",
          "                                   --json: \u8F93\u51FA\u673A\u5668\u53EF\u8BFB JSON",
          "  teamagent install-plugins [--dry-run] [--only=a,b] [--scope=user|project|local]",
          "                                   \u6CE8\u518C\u56E2\u961F\u6807\u914D plugins\uFF08superpowers/caveman/sales/playground\uFF09",
          "                                   \u901A\u8FC7 'claude plugin marketplace add' + 'claude plugin install' \u8C03 CC CLI",
          "                                   \u9ED8\u8BA4\u88C5\u5168\u90E8\uFF1B--only \u9650\u5B9A\u5B50\u96C6\uFF1B--dry-run \u53EA\u9884\u89C8",
          "  teamagent pair capsule --name=<device> --host=<host> [--user=<user>] [--out=<file>]",
          "                                   \u751F\u6210\u77ED\u671F teammate \u914D\u5BF9\u80F6\u56CA\uFF08\u4E0D\u5305\u542B SSH \u79C1\u94A5\uFF09",
          "  teamagent pair accept <capsule-file|token> [--local-name=<device>]",
          "                                   \u63A5\u53D7\u80F6\u56CA\uFF0C\u5199\u5165 peer \u8D26\u672C\u3001SSH config \u53D7\u7BA1\u5757\u548C\u6536\u636E",
          "  teamagent pair knock <peer> [--json] [--simulate]",
          "                                   \u901A\u8FC7 SSH \u9A8C\u8BC1\u914D\u5BF9\uFF1B--simulate \u7528\u4E8E\u79BB\u7EBF\u9A8C\u6536",
          "  teamagent pair list              \u5217\u51FA\u5DF2\u914D\u5BF9 teammate",
          "  teamagent disable                \u4E34\u65F6\u7981\u7528 Hook\uFF08\u4FDD\u7559\u6570\u636E\uFF09",
          "  teamagent enable                 \u91CD\u65B0\u542F\u7528 Hook",
          "  teamagent uninstall [--delete-data] [--dry-run]",
          "                                   \u5B8C\u5168\u5378\u8F7D\uFF1A\u79FB\u9664 Hook \u6CE8\u518C + \u6E05\u6389 CLAUDE.md \u533A\u5757\uFF1B\u52A0 --delete-data \u540C\u65F6\u6E05\u6570\u636E",
          "  teamagent calibrate [--days=7] [--dry-run]",
          "                                   \u6839\u636E events.jsonl \u91CD\u7B97 confidence + \u81EA\u52A8\u5F52\u6863\u4F4E\u5206\u6761\u76EE",
          "  teamagent verify [--report=path]",
          "                                   \u8DD1 5 \u4E2A\u9A8C\u8BC1\u573A\u666F\uFF08\u8E29\u5751\u2192\u5B66\u4E60\u2192\u907F\u5751\uFF09\uFF0C\u8F93\u51FA PRR/KP \u6307\u6807",
          "  teamagent e2e-evaluate [--json] [--keep-temp]",
          "                                   \u771F\u5B9E SQLite + analyze + compile + PreToolUse \u6D4B\u8BC4\u5B66\u4E60\u3001\u89E6\u53D1\u3001\u8BEF\u89E6\u53D1\u548C\u65B0\u6210\u5458\u53EF\u89C1\u6027",
          "  teamagent dogfood-report [--output=path]",
          "                                   \u626B events.jsonl + knowledge.jsonl + git log\uFF0C\u81EA\u52A8\u751F\u6210\u81EA\u4E3E\u62A5\u544A",
          "  teamagent compile [--dry-run] [--skills-only] [--markdown-only] [--force]",
          "                                   \u7F16\u8BD1\u53CC\u51FA\u53E3\uFF1ACLAUDE.md (canonical+, 3000 token \u9884\u7B97) + Agent Skills (stable+)",
          "                                   --dry-run: \u9884\u89C8\u5C06\u5199/\u5220\u54EA\u4E9B\u6587\u4EF6\uFF0C\u4E0D\u5B9E\u9645\u5199\u5165",
          "                                   --skills-only / --markdown-only: \u53EA\u5199\u5176\u4E2D\u4E00\u8DEF\u51FA\u53E3",
          "  teamagent config stop-mode <sync|async>  \u5207\u6362 Stop hook \u8FD0\u884C\u6A21\u5F0F\uFF08\u9ED8\u8BA4 sync\uFF09",
          "  teamagent config show                    \u67E5\u770B\u5F53\u524D\u914D\u7F6E",
          "  teamagent scan-errors [--mode=efficient|full] [--since=<duration|ISO>] [--min-freq=N] [--dry-run] [--quiet]",
          "                                   \u81EA\u52A8\u91C7\u96C6\u9519\u8BEF\u4FE1\u53F7 \u2192 \u63D0\u53D6\u5019\u9009\u89C4\u5219 \u2192 \u5199\u5165\u5019\u9009\u961F\u5217",
          "  teamagent review-candidates [--limit=N]",
          "                                   \u4EA4\u4E92\u5F0F\u5BA1\u6838\u5019\u9009\u89C4\u5219\uFF1A[a]\u6279\u51C6 [r]\u62D2\u7EDD [s]\u8DF3\u8FC7 [q]\u9000\u51FA",
          "  teamagent migrate-v6 [--dry-run] [--limit=N] [--db=<path>]",
          "                                   \u8FC1\u79FB\u65E7\u89C4\u5219\uFF08trigger_description \u4E3A\u7A7A\uFF09\u901A\u8FC7 LLM \u751F\u6210\u53CC\u63CF\u8FF0\uFF0C\u5E76\u5199\u5165 vec0 \u548C FTS5",
          "  teamagent migrate-v7 [--dry-run] [--limit=N] [--db=<path>]",
          "                                   \u6279\u91CF\u4E3A\u5B58\u91CF\u89C4\u5219\u751F\u6210 tool_context_description\uFF0C\u5E76\u5199\u5165 knowledge_tool_vec",
          "  teamagent ingest --from-insights <path> | --from-audit | --from-pr <n>",
          "                   | --from-git [--since=30d] | --from-ci [--since=30d] | --from-candidates <path>",
          "                                   \u591A\u6E90\u6444\u5165\uFF1AClaude /insights / npm audit / PR review / git hotspot / CI failure",
          "                                   \u534A\u81EA\u52A8\u6E90\u52A0 --dry-run \u53EA\u4EA7\u51FA\u5019\u9009 md \u4F9B\u4EBA\u5DE5\u52FE\u9009",
          "",
          "\u73AF\u5883\u53D8\u91CF:",
          "  TEAMAGENT_VISIBILITY=silent|smart|verbose    \u5F52\u56E0\u6E32\u67D3\u6A21\u5F0F\uFF08\u9ED8\u8BA4 verbose\uFF09",
          ""
        ].join("\n")
      );
      return;
    }
    default:
      process.stderr.write(`\u672A\u77E5\u547D\u4EE4: ${command}
`);
      process.exit(1);
  }
}
main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}
`);
  process.exit(1);
});
