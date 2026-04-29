import {
  ClaudeCodeLLMClient,
  ClaudePluginInstaller,
  MarkdownCompiler
} from "./chunk-NAWUQDTY.js";
import {
  DualLayerStore,
  SqliteKnowledgeStore
} from "./chunk-KGB2IXNQ.js";
import {
  openDb
} from "./chunk-UQ5KOJUO.js";
import {
  DEFAULT_IMPORT_CONFIDENCE,
  DEFAULT_MARKETPLACES,
  DEFAULT_PLUGINS,
  detectStack,
  extractCursorRules,
  extractRuleBullets,
  formatPluginSpec,
  getMetaPrinciples,
  structureRuleTextsBatch
} from "./chunk-VASCS3RI.js";
import {
  computeEnforcement
} from "./chunk-4EBMEK5Z.js";
import {
  installHook
} from "./chunk-MKFSZQXM.js";
import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/init.ts
init_esm_shims();
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

// ../cli/src/commands/install-plugins.ts
init_esm_shims();
function parseInstallPluginsArgs(argv) {
  const opts = { dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("--only=")) {
      opts.only = a.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith("--scope=")) {
      const s = a.slice("--scope=".length);
      if (s === "user" || s === "project" || s === "local") opts.scope = s;
    }
  }
  return opts;
}
async function executeInstallPlugins(opts = {}) {
  const dryRun = opts.dryRun ?? false;
  const installer = opts.installer ?? new ClaudePluginInstaller();
  const { plugins, unknown } = resolvePlugins(opts.only);
  const marketplaces = resolveMarketplaces(plugins);
  const marketplaceResults = [];
  const pluginResults = [];
  for (const m of marketplaces) {
    if (dryRun) {
      marketplaceResults.push({
        name: m.name,
        status: "would-do",
        detail: `(dry-run) would add marketplace ${m.repo}`
      });
      continue;
    }
    const outcome = await installer.addMarketplace(m);
    marketplaceResults.push(outcomeToItem(m.name, outcome));
  }
  for (const p of plugins) {
    const spec = formatPluginSpec(p);
    if (dryRun) {
      pluginResults.push({
        name: spec,
        status: "would-do",
        detail: `(dry-run) would install ${spec}`
      });
      continue;
    }
    const scopeOpt = opts.scope ? { scope: opts.scope } : {};
    const outcome = await installer.installPlugin(p, scopeOpt);
    pluginResults.push(outcomeToItem(spec, outcome));
  }
  for (const name of unknown) {
    pluginResults.push({
      name,
      status: "failed",
      detail: `unknown plugin: '${name}' is not in the default bundle`
    });
  }
  const summary = {
    added: countStatus([...marketplaceResults, ...pluginResults], "added"),
    alreadyPresent: countStatus([...marketplaceResults, ...pluginResults], "already"),
    failed: countStatus([...marketplaceResults, ...pluginResults], "failed"),
    wouldDo: countStatus([...marketplaceResults, ...pluginResults], "would-do")
  };
  const ok = summary.failed === 0;
  return { ok, dryRun, marketplaces: marketplaceResults, plugins: pluginResults, summary };
}
function renderInstallPluginsResult(result) {
  const lines = [];
  if (result.dryRun) {
    lines.push("\u26A0\uFE0F  \u9884\u89C8\u6A21\u5F0F\uFF08--dry-run\uFF09\uFF1A\u4EE5\u4E0B\u64CD\u4F5C\u4E0D\u4F1A\u5B9E\u9645\u6267\u884C");
    lines.push("");
  }
  if (result.marketplaces.length > 0) {
    lines.push("\u{1F4E6} Marketplaces:");
    for (const m of result.marketplaces) {
      lines.push(`   ${iconFor(m.status)} ${m.name}  ${truncate(m.detail, 100)}`);
    }
    lines.push("");
  }
  if (result.plugins.length > 0) {
    lines.push("\u{1F50C} Plugins:");
    for (const p of result.plugins) {
      lines.push(`   ${iconFor(p.status)} ${p.name}  ${truncate(p.detail, 100)}`);
    }
    lines.push("");
  }
  const s = result.summary;
  const parts = [];
  if (s.added) parts.push(`${s.added} \u65B0\u88C5`);
  if (s.alreadyPresent) parts.push(`${s.alreadyPresent} \u5DF2\u5B58\u5728`);
  if (s.failed) parts.push(`${s.failed} \u5931\u8D25`);
  if (s.wouldDo) parts.push(`${s.wouldDo} \u5C06\u6267\u884C`);
  lines.push("\u2500".repeat(36));
  lines.push(parts.length > 0 ? parts.join("\uFF0C") : "\u65E0\u4E8B\u53EF\u505A");
  if (result.ok && !result.dryRun) {
    lines.push("\u91CD\u542F Claude Code \u8BA9\u63D2\u4EF6\u52A0\u8F7D");
  }
  return lines.join("\n") + "\n";
}
function resolvePlugins(only) {
  if (!only || only.length === 0) {
    return { plugins: [...DEFAULT_PLUGINS], unknown: [] };
  }
  const byName = new Map(DEFAULT_PLUGINS.map((p) => [p.plugin, p]));
  const plugins = [];
  const unknown = [];
  for (const name of only) {
    const hit = byName.get(name);
    if (hit) plugins.push(hit);
    else unknown.push(name);
  }
  return { plugins, unknown };
}
function resolveMarketplaces(plugins) {
  const needed = new Set(plugins.map((p) => p.marketplace));
  return DEFAULT_MARKETPLACES.filter((m) => needed.has(m.name));
}
function outcomeToItem(name, outcome) {
  return { name, status: outcome.status, detail: outcome.detail };
}
function countStatus(items, status) {
  return items.filter((i) => i.status === status).length;
}
function iconFor(status) {
  switch (status) {
    case "added":
      return "\u2705";
    case "already":
      return "\u23ED ";
    case "failed":
      return "\u274C";
    case "would-do":
      return "\u{1F4DD}";
  }
}
function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

// ../cli/src/commands/init.ts
function resolvePaths(opts) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    home,
    cwd,
    projectDbPath: opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath: opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
    installLogPath: path.join(home, ".teamagent", ".install-log")
  };
}
function cwdFilePresence(cwd) {
  return {
    exists: (rel) => fs.existsSync(path.join(cwd, rel)),
    read: (rel) => {
      const full = path.join(cwd, rel);
      try {
        return fs.statSync(full).isFile() ? fs.readFileSync(full, "utf-8") : void 0;
      } catch {
        return void 0;
      }
    }
  };
}
async function executeInit(opts = {}) {
  const paths = resolvePaths(opts);
  const dryRun = opts.dryRun ?? false;
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const steps = [];
  const preCheck = runPreChecks(paths);
  steps.push(preCheck);
  if (preCheck.status === "failed") {
    return finalize(false, dryRun, steps, emptySummary());
  }
  const stackStep = doDetectStack(paths.cwd);
  steps.push(stackStep);
  const stackSummary = stackStep.detail;
  steps.push(doCreateDirs(paths, dryRun));
  const presetStep = doLoadPresets(paths.userGlobalDbPath, dryRun, now);
  steps.push(presetStep.step);
  const seedStep = opts.skipSeed ? { step: { step: "load-seed", status: "skipped", detail: "skipSeed=true" }, addedCount: 0, wouldAddCount: 0 } : doLoadSeed(paths.userGlobalDbPath, dryRun, opts.seedPath);
  steps.push(seedStep.step);
  const importStep = await doImportRules(paths, opts, dryRun, now);
  steps.push(...importStep.steps);
  if (!opts.skipHook) {
    steps.push(doInstallHook(paths.cwd, opts.hookEntry, dryRun));
  } else {
    steps.push({ step: "install-hook", status: "skipped", detail: "skipHook=true" });
  }
  if (opts.installPlugins) {
    steps.push(await doInstallPlugins(dryRun, opts.pluginInstaller));
  }
  const compileStep = doCompileClaudeMd(paths, dryRun, now);
  steps.push(compileStep);
  const skipWarmup = opts.skipWarmup === true || dryRun || process.env["NODE_ENV"] === "test" || process.env["TEAMAGENT_SKIP_WARMUP"] === "1";
  if (!skipWarmup) {
    try {
      const { runWarmup } = await import("./warmup-5BRQTZU6.js");
      const w = await runWarmup();
      steps.push({
        step: "warmup",
        status: w.ok ? "ok" : "failed",
        detail: w.ok ? `\u6A21\u578B\u9884\u70ED ${w.durationMs}ms` : `\u9884\u70ED\u5931\u8D25\uFF1A${w.error ?? "unknown"}`
      });
    } catch (err) {
      steps.push({
        step: "warmup",
        status: "failed",
        detail: `\u9884\u70ED\u5F02\u5E38\uFF1A${String(err).slice(0, 120)}`
      });
    }
  } else {
    steps.push({ step: "warmup", status: "skipped", detail: "skipWarmup / dryRun / test env" });
  }
  if (!dryRun) {
    try {
      appendInstallLog(paths.installLogPath, steps, now);
    } catch {
    }
  }
  let totalActive = 0;
  if (dryRun) {
    totalActive = presetStep.wouldAddCount + seedStep.wouldAddCount + importStep.wouldImport;
  } else {
    try {
      fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
      fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
      const store = new DualLayerStore({
        projectDbPath: paths.projectDbPath,
        userGlobalDbPath: paths.userGlobalDbPath
      });
      totalActive = store.findActive().length;
      store.close();
    } catch {
    }
  }
  const summary = {
    stack: stackSummary,
    presetAdded: presetStep.addedCount,
    seedAdded: seedStep.addedCount,
    importedRules: importStep.importedCount,
    totalActiveEntries: totalActive
  };
  const ok = !steps.some((s) => s.status === "failed");
  return finalize(ok, dryRun, steps, summary);
}
function runPreChecks(paths) {
  if (!fs.existsSync(paths.cwd)) {
    return failStep("pre-check", `\u9879\u76EE\u76EE\u5F55\u4E0D\u5B58\u5728: ${paths.cwd}`);
  }
  try {
    const tDir = path.join(paths.home, ".teamagent");
    fs.mkdirSync(tDir, { recursive: true });
    const probe = path.join(tDir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
  } catch {
    return failStep("pre-check", "\u65E0\u6CD5\u521B\u5EFA ~/.teamagent \u76EE\u5F55\uFF0C\u8BF7\u68C0\u67E5\u78C1\u76D8\u6743\u9650");
  }
  if (fs.existsSync(paths.claudeMdPath)) {
    try {
      fs.accessSync(paths.claudeMdPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      return failStep("pre-check", "CLAUDE.md \u6587\u4EF6\u65E0\u5199\u5165\u6743\u9650\uFF0C\u8BF7\u8FD0\u884C: chmod 644 CLAUDE.md");
    }
  }
  return okStep("pre-check", "\u6240\u6709\u524D\u7F6E\u68C0\u67E5\u901A\u8FC7");
}
function doDetectStack(cwd) {
  const fp = cwdFilePresence(cwd);
  const stack = detectStack(fp);
  const parts = [];
  if (stack.languages.length) parts.push(`lang=${stack.languages.join("+")}`);
  if (stack.frameworks.length) parts.push(`fw=${stack.frameworks.join("+")}`);
  if (stack.packageManagers.length) parts.push(`pm=${stack.packageManagers.join("+")}`);
  if (stack.testRunners.length) parts.push(`test=${stack.testRunners.join("+")}`);
  if (stack.otherSignals.length) parts.push(`other=${stack.otherSignals.join("+")}`);
  const detail = parts.length > 0 ? parts.join("  ") : "(\u8BC6\u522B\u4E0D\u5230\u5178\u578B\u4FE1\u53F7)";
  return okStep("detect-stack", detail);
}
function doCreateDirs(paths, dryRun) {
  const toCreate = [
    path.dirname(paths.projectDbPath),
    path.dirname(paths.userGlobalDbPath)
  ];
  if (dryRun) {
    return okStep("create-dirs", `(dry-run) \u4F1A\u521B\u5EFA: ${toCreate.join(", ")}`);
  }
  try {
    for (const d of toCreate) fs.mkdirSync(d, { recursive: true });
    return okStep("create-dirs", `\u5DF2\u786E\u4FDD\u76EE\u5F55\u5B58\u5728: ${toCreate.length} \u4E2A`);
  } catch (err) {
    return failStep("create-dirs", String(err).slice(0, 200));
  }
}
function doLoadPresets(userGlobalDbPath, dryRun, now) {
  const presets = getMetaPrinciples(now);
  if (dryRun) {
    return {
      step: okStep("load-preset", `(dry-run) \u4F1A\u5199\u5165 ${presets.length} \u6761\u5143\u539F\u5219`),
      addedCount: 0,
      wouldAddCount: presets.length
    };
  }
  try {
    fs.mkdirSync(path.dirname(userGlobalDbPath), { recursive: true });
    const store = new SqliteKnowledgeStore(openDb(userGlobalDbPath));
    let added = 0;
    for (const p of presets) {
      if (store.getById(p.id)) continue;
      store.add(p);
      added++;
    }
    store.close();
    return {
      step: okStep("load-preset", `\u6CE8\u5165\u5143\u539F\u5219 ${added} \u6761\uFF08\u603B ${presets.length} \u6761\uFF0C${presets.length - added} \u6761\u5DF2\u5B58\u5728\uFF09`),
      addedCount: added,
      wouldAddCount: presets.length
    };
  } catch (err) {
    return {
      step: failStep("load-preset", String(err).slice(0, 200)),
      addedCount: 0,
      wouldAddCount: 0
    };
  }
}
function resolveSeedPath() {
  const here = fileURLToPath(import.meta.url);
  let dir = path.dirname(here);
  for (let i = 0; i < 8; i++) {
    const bundled = path.join(dir, "dist", "seed", "rules.jsonl");
    if (fs.existsSync(bundled)) return bundled;
    const dev = path.join(dir, "packages", "teamagent", "seed", "rules.jsonl");
    if (fs.existsSync(dev)) return dev;
    const siblingSeed = path.join(dir, "..", "teamagent", "seed", "rules.jsonl");
    if (fs.existsSync(siblingSeed)) return siblingSeed;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return void 0;
}
function doLoadSeed(userGlobalDbPath, dryRun, explicitSeedPath) {
  const seedPath = explicitSeedPath ?? resolveSeedPath();
  if (!seedPath) {
    return {
      step: okStep("load-seed", "\u672A\u627E\u5230 seed/rules.jsonl\uFF08\u5F00\u53D1\u5B89\u88C5\u6216 tarball \u7F3A\u5931\uFF09\uFF0C\u8DF3\u8FC7"),
      addedCount: 0,
      wouldAddCount: 0
    };
  }
  let entries;
  try {
    const text = fs.readFileSync(seedPath, "utf-8");
    entries = text.split(/\r?\n/).filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
  } catch (err) {
    return {
      step: failStep("load-seed", `\u8BFB\u53D6 seed \u5931\u8D25: ${String(err).slice(0, 150)}`),
      addedCount: 0,
      wouldAddCount: 0
    };
  }
  if (dryRun) {
    return {
      step: okStep("load-seed", `(dry-run) \u4F1A\u6CE8\u5165 ${entries.length} \u6761\u6253\u5305\u89C4\u5219`),
      addedCount: 0,
      wouldAddCount: entries.length
    };
  }
  try {
    fs.mkdirSync(path.dirname(userGlobalDbPath), { recursive: true });
    const store = new SqliteKnowledgeStore(openDb(userGlobalDbPath));
    let added = 0;
    for (const e of entries) {
      if (store.getById(e.id)) continue;
      try {
        store.add(e);
        added++;
      } catch {
      }
    }
    store.close();
    return {
      step: okStep(
        "load-seed",
        `\u6CE8\u5165\u6253\u5305\u89C4\u5219 ${added} \u6761\uFF08\u603B ${entries.length} \u6761\uFF0C${entries.length - added} \u6761\u5DF2\u5B58\u5728\uFF09`
      ),
      addedCount: added,
      wouldAddCount: entries.length
    };
  } catch (err) {
    return {
      step: failStep("load-seed", String(err).slice(0, 200)),
      addedCount: 0,
      wouldAddCount: 0
    };
  }
}
async function doImportRules(paths, opts, dryRun, now) {
  const steps = [];
  const claudeMdExists = fs.existsSync(paths.claudeMdPath);
  const cursorRulesPath = path.join(paths.cwd, ".cursorrules");
  const cursorExists = fs.existsSync(cursorRulesPath);
  const rawTexts = [];
  const scanDetails = [];
  if (claudeMdExists) {
    const md = fs.readFileSync(paths.claudeMdPath, "utf-8");
    const bullets = extractRuleBullets(md);
    scanDetails.push(`CLAUDE.md: ${bullets.length} bullets`);
    rawTexts.push(...bullets);
  }
  if (cursorExists) {
    const text = fs.readFileSync(cursorRulesPath, "utf-8");
    const rules = extractCursorRules(text);
    scanDetails.push(`.cursorrules: ${rules.length} rules`);
    rawTexts.push(...rules);
  }
  steps.push(
    okStep(
      "scan-rules",
      scanDetails.length > 0 ? scanDetails.join(", ") : "CLAUDE.md / .cursorrules \u5747\u4E0D\u5B58\u5728\uFF0C\u8DF3\u8FC7\u5BFC\u5165"
    )
  );
  if (rawTexts.length === 0) {
    return {
      steps: [...steps, okStep("structure-rules", "\u65E0\u89C4\u5219\u53EF\u5BFC\u5165")],
      importedCount: 0,
      wouldImport: 0
    };
  }
  if (opts.skipImport) {
    steps.push(
      okStep(
        "structure-rules",
        `skipImport=true\uFF0C\u8DF3\u8FC7\uFF08${rawTexts.length} \u6761\u89C4\u5219\u672A\u5BFC\u5165\uFF09`
      )
    );
    return { steps, importedCount: 0, wouldImport: rawTexts.length };
  }
  if (dryRun) {
    steps.push(
      okStep(
        "structure-rules",
        `(dry-run) \u4F1A LLM \u7ED3\u6784\u5316 ${rawTexts.length} \u6761\u89C4\u5219\u5199\u5165 personal store`
      )
    );
    return { steps, importedCount: 0, wouldImport: rawTexts.length };
  }
  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  const idGen = opts.idGen ?? (() => defaultIdGen(now));
  try {
    const result = await structureRuleTextsBatch(
      rawTexts,
      (prompt) => llm.complete(prompt),
      { now }
    );
    fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
    const store = new SqliteKnowledgeStore(openDb(paths.projectDbPath));
    let imported = 0;
    for (const { partial } of result.structured) {
      const entry = assembleImported(partial, idGen(), now);
      try {
        store.add(entry);
        imported++;
      } catch {
      }
    }
    store.close();
    steps.push(
      okStep(
        "structure-rules",
        `\u6210\u529F\u5BFC\u5165 ${imported}/${rawTexts.length}\uFF08\u8DF3\u8FC7 ${result.skipped}\uFF0C\u5931\u8D25 ${result.failed}\uFF09`
      )
    );
    return { steps, importedCount: imported, wouldImport: rawTexts.length };
  } catch (err) {
    steps.push(failStep("structure-rules", String(err).slice(0, 200)));
    return { steps, importedCount: 0, wouldImport: rawTexts.length };
  }
}
async function doInstallPlugins(dryRun, injected) {
  if (dryRun) {
    return okStep(
      "install-plugins",
      "(dry-run) \u4F1A\u6CE8\u518C\u56E2\u961F\u6807\u914D marketplaces + plugins"
    );
  }
  try {
    const opts = {};
    if (injected) opts.installer = injected;
    const result = await executeInstallPlugins(opts);
    const s = result.summary;
    const detail = [
      s.added ? `${s.added} \u65B0\u88C5` : "",
      s.alreadyPresent ? `${s.alreadyPresent} \u5DF2\u5B58\u5728` : "",
      s.failed ? `${s.failed} \u5931\u8D25` : ""
    ].filter(Boolean).join("\uFF0C") || "\u65E0\u4E8B\u53EF\u505A";
    return result.ok ? okStep("install-plugins", detail) : failStep("install-plugins", detail);
  } catch (err) {
    return failStep("install-plugins", String(err).slice(0, 200));
  }
}
function doInstallHook(cwd, hookEntry, dryRun) {
  if (dryRun) {
    return okStep(
      "install-hook",
      `(dry-run) \u4F1A\u5199\u5165 ${path.join(cwd, ".claude", "settings.local.json")}`
    );
  }
  try {
    const r = installHook({ cwd, ...hookEntry ? { hookEntry } : {} });
    const parts = [];
    parts.push(r.alreadyInstalled ? `\u5DF2\u5B89\u88C5 (\u65E0\u53D8\u5316): ${r.settingsPath}` : `\u5DF2\u6CE8\u518C: ${r.settingsPath}`);
    if (r.statusLineSkipped) {
      parts.push("\u26A0\uFE0F  \u68C0\u6D4B\u5230\u5DF2\u6709 statusLine\uFF0C\u672A\u8986\u76D6\uFF1B\u5982\u8981\u542F\u7528 TeamAgent \u72B6\u6001\u680F\uFF0C\u8BF7\u624B\u52A8\u5220\u9664\u539F\u6709\u518D\u91CD\u8DD1");
    }
    return okStep("install-hook", parts.join(" \xB7 "));
  } catch (err) {
    return failStep("install-hook", String(err).slice(0, 200));
  }
}
function doCompileClaudeMd(paths, dryRun, now) {
  if (dryRun) {
    return okStep(
      "compile-claude-md",
      `(dry-run) \u4F1A\u628A\u6D3B\u8DC3\u6761\u76EE\u5408\u5E76\u7F16\u8BD1\u5230 ${paths.claudeMdPath}`
    );
  }
  try {
    fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
    fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
    const store = new DualLayerStore({
      projectDbPath: paths.projectDbPath,
      userGlobalDbPath: paths.userGlobalDbPath
    });
    const all = store.findActive();
    store.close();
    const compiler = new MarkdownCompiler(paths.claudeMdPath, () => now().toISOString());
    const info = compiler.writeToFile(all);
    return okStep(
      "compile-claude-md",
      `\u5DF2\u7F16\u8BD1 ${all.length} \u6761 \u2192 ${info.filePath}`
    );
  } catch (err) {
    return failStep("compile-claude-md", String(err).slice(0, 200));
  }
}
function appendInstallLog(logPath, steps, now) {
  const dir = path.dirname(logPath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = { ts: now().toISOString(), steps };
  fs.appendFileSync(logPath, JSON.stringify(payload) + "\n", "utf-8");
}
function assembleImported(partial, id, now) {
  const confidence = partial.confidence ?? DEFAULT_IMPORT_CONFIDENCE;
  const nature = partial.nature ?? "subjective";
  const nowIso = now().toISOString();
  return {
    id,
    scope: { level: "personal" },
    category: partial.category ?? "E",
    tags: partial.tags ?? [],
    type: partial.type ?? "practice",
    nature,
    trigger: partial.trigger ?? "",
    wrong_pattern: partial.wrong_pattern ?? "",
    correct_pattern: partial.correct_pattern ?? "",
    reasoning: partial.reasoning ?? "",
    confidence,
    enforcement: computeEnforcement(confidence, nature),
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: nowIso,
    last_hit_at: "",
    last_validated_at: nowIso,
    source: "imported",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0
  };
}
function defaultIdGen(now) {
  const ts = now().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `pers-${ts}-${rand}`;
}
function okStep(step, detail) {
  return { step, status: "ok", detail };
}
function failStep(step, detail) {
  return { step, status: "failed", detail };
}
function emptySummary() {
  return { stack: "", presetAdded: 0, seedAdded: 0, importedRules: 0, totalActiveEntries: 0 };
}
function finalize(ok, dryRun, steps, summary) {
  return { ok, dryRun, steps, summary };
}
function parseInitArgs(argv) {
  const opts = {};
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skip-import") opts.skipImport = true;
    else if (a === "--skip-hook") opts.skipHook = true;
    else if (a === "--skip-warmup") opts.skipWarmup = true;
    else if (a === "--install-plugins") opts.installPlugins = true;
  }
  return opts;
}
function renderInitResult(result) {
  const lines = [];
  if (result.dryRun) {
    lines.push("\u26A0\uFE0F  \u9884\u89C8\u6A21\u5F0F\uFF08--dry-run\uFF09\uFF1A\u4EE5\u4E0B\u64CD\u4F5C\u4E0D\u4F1A\u5B9E\u9645\u6267\u884C\n");
  }
  const stepGroups = [
    { icon: "\u{1F50D}", label: "\u68C0\u6D4B\u9879\u76EE\u73AF\u5883", stepKeys: ["detect-stack"] },
    { icon: "\u{1F4E6}", label: "\u521D\u59CB\u5316\u77E5\u8BC6\u5E93", stepKeys: ["pre-check", "create-dirs", "load-preset", "load-seed", "scan-rules", "structure-rules"] },
    { icon: "\u{1F517}", label: "\u6CE8\u518C Hook", stepKeys: ["install-hook"] },
    { icon: "\u{1F50C}", label: "\u5B89\u88C5\u56E2\u961F\u6807\u914D\u63D2\u4EF6", stepKeys: ["install-plugins"] },
    { icon: "\u{1F4C4}", label: "\u7F16\u8BD1 CLAUDE.md", stepKeys: ["compile-claude-md"] }
  ];
  for (const group of stepGroups) {
    const groupSteps = result.steps.filter((s) => group.stepKeys.includes(s.step));
    if (groupSteps.length === 0) continue;
    lines.push(`${group.icon} ${group.label}...`);
    for (const s of groupSteps) {
      if (s.step === "detect-stack" && s.status === "ok") {
        lines.push(`   \u6280\u672F\u6808: ${s.detail}`);
      } else if (s.status === "ok") {
        lines.push(`   \u2705 ${stepLabel(s.step)}: ${s.detail}`);
      } else if (s.status === "skipped") {
        lines.push(`   \u23ED  ${stepLabel(s.step)}: ${s.detail}`);
      } else {
        lines.push(`   \u274C ${stepLabel(s.step)}: ${friendlyError(s.detail)}`);
      }
    }
    lines.push("");
  }
  lines.push("\u2501".repeat(36));
  if (result.ok) {
    lines.push("\u2705 TeamAgent \u5B89\u88C5\u6210\u529F\uFF01\n");
    lines.push("\u4E0B\u4E00\u6B65:");
    lines.push("  1. \u91CD\u65B0\u6253\u5F00 Claude Code\uFF08\u8BA9 hook \u751F\u6548\uFF09");
    lines.push("  2. \u8FD0\u884C teamagent doctor \u9A8C\u8BC1\u5B89\u88C5");
    lines.push("  3. \u8FD0\u884C teamagent stats \u67E5\u770B\u77E5\u8BC6\u5E93\u72B6\u6001");
    const pluginsInstalled = result.steps.some(
      (s) => s.step === "install-plugins"
    );
    if (!pluginsInstalled) {
      lines.push("");
      lines.push("\u{1F4A1} \u56E2\u961F\u6807\u914D\u63D2\u4EF6\uFF08superpowers/caveman/sales/playground\uFF09\u9ED8\u8BA4\u4E0D\u88C5");
      lines.push("   \u9700\u8981\u65F6\u8FD0\u884C: teamagent install-plugins");
    }
  } else {
    lines.push("\u274C \u5B89\u88C5\u672A\u5B8C\u6210\uFF0C\u8BF7\u4FEE\u590D\u4EE5\u4E0A\u95EE\u9898\u540E\u91CD\u8BD5");
    lines.push("   \u8FD0\u884C teamagent doctor \u83B7\u53D6\u8BCA\u65AD\u5EFA\u8BAE");
  }
  return lines.join("\n") + "\n";
}
function stepLabel(step) {
  const map = {
    "pre-check": "\u524D\u7F6E\u68C0\u67E5",
    "detect-stack": "\u6280\u672F\u6808",
    "create-dirs": "\u76EE\u5F55\u521B\u5EFA",
    "load-preset": "\u9884\u7F6E\u89C4\u5219",
    "load-seed": "\u6253\u5305\u89C4\u5219",
    "scan-rules": "\u626B\u63CF\u89C4\u5219",
    "structure-rules": "\u5BFC\u5165\u89C4\u5219",
    "install-hook": "Hook \u6CE8\u518C",
    "install-plugins": "Plugin \u5B89\u88C5",
    "compile-claude-md": "CLAUDE.md"
  };
  return map[step] ?? step;
}
function friendlyError(raw) {
  if (raw.includes("ENOENT") && raw.includes(".teamagent")) {
    return "\u65E0\u6CD5\u521B\u5EFA ~/.teamagent \u76EE\u5F55\uFF0C\u8BF7\u68C0\u67E5\u78C1\u76D8\u6743\u9650";
  }
  if (raw.includes("sqlite-vec") || raw.includes("extension")) {
    return "sqlite-vec \u6269\u5C55\u52A0\u8F7D\u5931\u8D25\u3002\u8FD0\u884C teamagent doctor \u8BCA\u65AD";
  }
  if (raw.includes("CLAUDE.md") && (raw.includes("EACCES") || raw.includes("\u4E0D\u53EF\u8BFB\u5199"))) {
    return "CLAUDE.md \u6587\u4EF6\u65E0\u5199\u5165\u6743\u9650\uFF0C\u8BF7\u8FD0\u884C: chmod 644 CLAUDE.md";
  }
  if (raw.length < 120) return raw;
  return raw.slice(0, 100) + "...";
}

export {
  parseInstallPluginsArgs,
  executeInstallPlugins,
  renderInstallPluginsResult,
  executeInit,
  parseInitArgs,
  renderInitResult
};
