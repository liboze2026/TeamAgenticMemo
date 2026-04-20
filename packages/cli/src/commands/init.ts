import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  DualLayerStore,
  SqliteKnowledgeStore,
  MarkdownCompiler,
  ClaudeCodeLLMClient,
  openDb,
} from "@teamagent/adapters";
import {
  detectStack,
  getMetaPrinciples,
  extractRuleBullets,
  extractCursorRules,
  structureRuleTextsBatch,
  DEFAULT_IMPORT_CONFIDENCE,
  type FilePresence,
} from "@teamagent/core";
import type { LLMClient } from "@teamagent/ports";
import type { KnowledgeEntry } from "@teamagent/types";
import { computeEnforcement } from "@teamagent/types";
import { installHook } from "./install-hook.js";

export interface InitOptions {
  cwd?: string;
  homeDir?: string;
  /** 预览模式：只检查、只输出"会做什么"，不写任何文件。 */
  dryRun?: boolean;
  /** 注入 LLM（测试用）；缺省用 ClaudeCodeLLMClient。 */
  llmClient?: LLMClient;
  /** 若为 true，跳过 LLM 导入步骤（例如无网络/无 claude CLI 时快装）。 */
  skipImport?: boolean;
  /** 跳过 hook 安装（测试环境下 dist bundle 可能不存在）。 */
  skipHook?: boolean;
  projectDbPath?: string;
  userGlobalDbPath?: string;
  claudeMdPath?: string;
  hookEntry?: string;
  now?: () => Date;
  idGen?: () => string;
}

export interface InitStepResult {
  step: string;
  status: "ok" | "skipped" | "failed";
  detail: string;
}

export interface InitResult {
  ok: boolean;
  dryRun: boolean;
  steps: InitStepResult[];
  summary: {
    stack: string;
    presetAdded: number;
    importedRules: number;
    totalActiveEntries: number;
  };
}

function resolvePaths(opts: InitOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    home,
    cwd,
    projectDbPath:
      opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath:
      opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
    installLogPath: path.join(home, ".teamagent", ".install-log"),
  };
}

function cwdFilePresence(cwd: string): FilePresence {
  return {
    exists: (rel) => fs.existsSync(path.join(cwd, rel)),
    read: (rel) => {
      const full = path.join(cwd, rel);
      try {
        return fs.statSync(full).isFile()
          ? fs.readFileSync(full, "utf-8")
          : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

export async function executeInit(opts: InitOptions = {}): Promise<InitResult> {
  const paths = resolvePaths(opts);
  const dryRun = opts.dryRun ?? false;
  const now = opts.now ?? (() => new Date());
  const steps: InitStepResult[] = [];

  // ---------- Phase A: Pre-check ----------
  const preCheck = runPreChecks(paths);
  steps.push(preCheck);
  if (preCheck.status === "failed") {
    return finalize(false, dryRun, steps, emptySummary());
  }

  // ---------- Phase B: Execute ----------

  const stackStep = doDetectStack(paths.cwd);
  steps.push(stackStep);
  const stackSummary = stackStep.detail;

  steps.push(doCreateDirs(paths, dryRun));

  const presetStep = doLoadPresets(paths.userGlobalDbPath, dryRun, now);
  steps.push(presetStep.step);

  const importStep = await doImportRules(paths, opts, dryRun, now);
  steps.push(...importStep.steps);

  if (!opts.skipHook) {
    steps.push(doInstallHook(paths.cwd, opts.hookEntry, dryRun));
  } else {
    steps.push({ step: "install-hook", status: "skipped", detail: "skipHook=true" });
  }

  const compileStep = doCompileClaudeMd(paths, dryRun, now);
  steps.push(compileStep);

  if (!dryRun) {
    try {
      appendInstallLog(paths.installLogPath, steps, now);
    } catch {
      // ignore
    }
  }

  let totalActive = 0;
  if (dryRun) {
    totalActive = presetStep.wouldAddCount + importStep.wouldImport;
  } else {
    try {
      fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
      fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
      const store = new DualLayerStore({
        projectDbPath: paths.projectDbPath,
        userGlobalDbPath: paths.userGlobalDbPath,
      });
      totalActive = store.findActive().length;
      store.close();
    } catch {
      // ignore
    }
  }

  const summary = {
    stack: stackSummary,
    presetAdded: presetStep.addedCount,
    importedRules: importStep.importedCount,
    totalActiveEntries: totalActive,
  };
  const ok = !steps.some((s) => s.status === "failed");
  return finalize(ok, dryRun, steps, summary);
}

// ======================== Step implementations ========================

function runPreChecks(paths: ReturnType<typeof resolvePaths>): InitStepResult {
  if (!fs.existsSync(paths.cwd)) {
    return failStep("pre-check", `项目目录不存在: ${paths.cwd}`);
  }
  try {
    const tDir = path.join(paths.home, ".teamagent");
    fs.mkdirSync(tDir, { recursive: true });
    const probe = path.join(tDir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
  } catch {
    return failStep("pre-check", "无法创建 ~/.teamagent 目录，请检查磁盘权限");
  }
  if (fs.existsSync(paths.claudeMdPath)) {
    try {
      fs.accessSync(paths.claudeMdPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      return failStep("pre-check", "CLAUDE.md 文件无写入权限，请运行: chmod 644 CLAUDE.md");
    }
  }
  return okStep("pre-check", "所有前置检查通过");
}

function doDetectStack(cwd: string): InitStepResult {
  const fp = cwdFilePresence(cwd);
  const stack = detectStack(fp);
  const parts: string[] = [];
  if (stack.languages.length) parts.push(`lang=${stack.languages.join("+")}`);
  if (stack.frameworks.length) parts.push(`fw=${stack.frameworks.join("+")}`);
  if (stack.packageManagers.length) parts.push(`pm=${stack.packageManagers.join("+")}`);
  if (stack.testRunners.length) parts.push(`test=${stack.testRunners.join("+")}`);
  if (stack.otherSignals.length) parts.push(`other=${stack.otherSignals.join("+")}`);
  const detail = parts.length > 0 ? parts.join("  ") : "(识别不到典型信号)";
  return okStep("detect-stack", detail);
}

function doCreateDirs(
  paths: ReturnType<typeof resolvePaths>,
  dryRun: boolean,
): InitStepResult {
  const toCreate = [
    path.dirname(paths.projectDbPath),
    path.dirname(paths.userGlobalDbPath),
  ];
  if (dryRun) {
    return okStep("create-dirs", `(dry-run) 会创建: ${toCreate.join(", ")}`);
  }
  try {
    for (const d of toCreate) fs.mkdirSync(d, { recursive: true });
    return okStep("create-dirs", `已确保目录存在: ${toCreate.length} 个`);
  } catch (err) {
    return failStep("create-dirs", String(err).slice(0, 200));
  }
}

function doLoadPresets(
  userGlobalDbPath: string,
  dryRun: boolean,
  now: () => Date,
): { step: InitStepResult; addedCount: number; wouldAddCount: number } {
  const presets = getMetaPrinciples(now);
  if (dryRun) {
    return {
      step: okStep("load-preset", `(dry-run) 会写入 ${presets.length} 条元原则`),
      addedCount: 0,
      wouldAddCount: presets.length,
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
      step: okStep("load-preset", `注入元原则 ${added} 条（总 ${presets.length} 条，${presets.length - added} 条已存在）`),
      addedCount: added,
      wouldAddCount: presets.length,
    };
  } catch (err) {
    return {
      step: failStep("load-preset", String(err).slice(0, 200)),
      addedCount: 0,
      wouldAddCount: 0,
    };
  }
}

async function doImportRules(
  paths: ReturnType<typeof resolvePaths>,
  opts: InitOptions,
  dryRun: boolean,
  now: () => Date,
): Promise<{ steps: InitStepResult[]; importedCount: number; wouldImport: number }> {
  const steps: InitStepResult[] = [];
  const claudeMdExists = fs.existsSync(paths.claudeMdPath);
  const cursorRulesPath = path.join(paths.cwd, ".cursorrules");
  const cursorExists = fs.existsSync(cursorRulesPath);

  const rawTexts: string[] = [];
  const scanDetails: string[] = [];
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
      scanDetails.length > 0
        ? scanDetails.join(", ")
        : "CLAUDE.md / .cursorrules 均不存在，跳过导入",
    ),
  );

  if (rawTexts.length === 0) {
    return {
      steps: [...steps, okStep("structure-rules", "无规则可导入")],
      importedCount: 0,
      wouldImport: 0,
    };
  }

  if (opts.skipImport) {
    steps.push(
      okStep(
        "structure-rules",
        `skipImport=true，跳过（${rawTexts.length} 条规则未导入）`,
      ),
    );
    return { steps, importedCount: 0, wouldImport: rawTexts.length };
  }

  if (dryRun) {
    steps.push(
      okStep(
        "structure-rules",
        `(dry-run) 会 LLM 结构化 ${rawTexts.length} 条规则写入 personal store`,
      ),
    );
    return { steps, importedCount: 0, wouldImport: rawTexts.length };
  }

  const llm = opts.llmClient ?? new ClaudeCodeLLMClient();
  const idGen = opts.idGen ?? (() => defaultIdGen(now));
  try {
    const result = await structureRuleTextsBatch(
      rawTexts,
      (prompt) => llm.complete(prompt),
      { now },
    );
    // Import into personal scope (project DB)
    fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
    const store = new SqliteKnowledgeStore(openDb(paths.projectDbPath));
    let imported = 0;
    for (const { partial } of result.structured) {
      const entry = assembleImported(partial, idGen(), now);
      try {
        store.add(entry);
        imported++;
      } catch {
        // 重复 id 或 schema 异常，跳过
      }
    }
    store.close();
    steps.push(
      okStep(
        "structure-rules",
        `成功导入 ${imported}/${rawTexts.length}（跳过 ${result.skipped}，失败 ${result.failed}）`,
      ),
    );
    return { steps, importedCount: imported, wouldImport: rawTexts.length };
  } catch (err) {
    steps.push(failStep("structure-rules", String(err).slice(0, 200)));
    return { steps, importedCount: 0, wouldImport: rawTexts.length };
  }
}

function doInstallHook(
  cwd: string,
  hookEntry: string | undefined,
  dryRun: boolean,
): InitStepResult {
  if (dryRun) {
    return okStep(
      "install-hook",
      `(dry-run) 会写入 ${path.join(cwd, ".claude", "settings.local.json")}`,
    );
  }
  try {
    const r = installHook({ cwd, ...(hookEntry ? { hookEntry } : {}) });
    return okStep(
      "install-hook",
      r.alreadyInstalled ? `已安装 (无变化): ${r.settingsPath}` : `已注册: ${r.settingsPath}`,
    );
  } catch (err) {
    return failStep("install-hook", String(err).slice(0, 200));
  }
}

function doCompileClaudeMd(
  paths: ReturnType<typeof resolvePaths>,
  dryRun: boolean,
  now: () => Date,
): InitStepResult {
  if (dryRun) {
    return okStep(
      "compile-claude-md",
      `(dry-run) 会把活跃条目合并编译到 ${paths.claudeMdPath}`,
    );
  }
  try {
    fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
    fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
    const store = new DualLayerStore({
      projectDbPath: paths.projectDbPath,
      userGlobalDbPath: paths.userGlobalDbPath,
    });
    const all = store.findActive();
    store.close();
    const compiler = new MarkdownCompiler(paths.claudeMdPath, () => now().toISOString());
    const info = compiler.writeToFile(all);
    return okStep(
      "compile-claude-md",
      `已编译 ${all.length} 条 → ${info.filePath}`,
    );
  } catch (err) {
    return failStep("compile-claude-md", String(err).slice(0, 200));
  }
}

function appendInstallLog(
  logPath: string,
  steps: InitStepResult[],
  now: () => Date,
): void {
  const dir = path.dirname(logPath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = { ts: now().toISOString(), steps };
  fs.appendFileSync(logPath, JSON.stringify(payload) + "\n", "utf-8");
}

function assembleImported(
  partial: Partial<KnowledgeEntry>,
  id: string,
  now: () => Date,
): KnowledgeEntry {
  const confidence = partial.confidence ?? DEFAULT_IMPORT_CONFIDENCE;
  const nature = (partial.nature ?? "subjective") as "objective" | "subjective";
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
    current_tier: "experimental" as const,
    max_tier_ever: "experimental" as const,
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
  };
}

function defaultIdGen(now: () => Date): string {
  const ts = now().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `pers-${ts}-${rand}`;
}

function okStep(step: string, detail: string): InitStepResult {
  return { step, status: "ok", detail };
}
function failStep(step: string, detail: string): InitStepResult {
  return { step, status: "failed", detail };
}
function emptySummary() {
  return { stack: "", presetAdded: 0, importedRules: 0, totalActiveEntries: 0 };
}
function finalize(
  ok: boolean,
  dryRun: boolean,
  steps: InitStepResult[],
  summary: InitResult["summary"],
): InitResult {
  return { ok, dryRun, steps, summary };
}

// ======================== CLI glue ========================

export function parseInitArgs(argv: string[]): InitOptions {
  const opts: InitOptions = {};
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skip-import") opts.skipImport = true;
    else if (a === "--skip-hook") opts.skipHook = true;
  }
  return opts;
}

export function renderInitResult(result: InitResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push("⚠️  预览模式（--dry-run）：以下操作不会实际执行\n");
  }

  // Group steps for display
  const stepGroups: Array<{ icon: string; label: string; stepKeys: string[] }> = [
    { icon: "🔍", label: "检测项目环境", stepKeys: ["detect-stack"] },
    { icon: "📦", label: "初始化知识库", stepKeys: ["pre-check", "create-dirs", "load-preset", "scan-rules", "structure-rules"] },
    { icon: "🔗", label: "注册 Hook", stepKeys: ["install-hook"] },
    { icon: "📄", label: "编译 CLAUDE.md", stepKeys: ["compile-claude-md"] },
  ];

  for (const group of stepGroups) {
    const groupSteps = result.steps.filter((s) => group.stepKeys.includes(s.step));
    if (groupSteps.length === 0) continue;
    lines.push(`${group.icon} ${group.label}...`);
    for (const s of groupSteps) {
      if (s.step === "detect-stack" && s.status === "ok") {
        lines.push(`   技术栈: ${s.detail}`);
      } else if (s.status === "ok") {
        lines.push(`   ✅ ${stepLabel(s.step)}: ${s.detail}`);
      } else if (s.status === "skipped") {
        lines.push(`   ⏭  ${stepLabel(s.step)}: ${s.detail}`);
      } else {
        lines.push(`   ❌ ${stepLabel(s.step)}: ${friendlyError(s.detail)}`);
      }
    }
    lines.push("");
  }

  lines.push("━".repeat(36));
  if (result.ok) {
    lines.push("✅ TeamAgent 安装成功！\n");
    lines.push("下一步:");
    lines.push("  1. 重新打开 Claude Code（让 hook 生效）");
    lines.push("  2. 运行 teamagent doctor 验证安装");
    lines.push("  3. 运行 teamagent stats 查看知识库状态");
  } else {
    lines.push("❌ 安装未完成，请修复以上问题后重试");
    lines.push("   运行 teamagent doctor 获取诊断建议");
  }

  return lines.join("\n") + "\n";
}

function stepLabel(step: string): string {
  const map: Record<string, string> = {
    "pre-check": "前置检查",
    "detect-stack": "技术栈",
    "create-dirs": "目录创建",
    "load-preset": "预置规则",
    "scan-rules": "扫描规则",
    "structure-rules": "导入规则",
    "install-hook": "Hook 注册",
    "compile-claude-md": "CLAUDE.md",
  };
  return map[step] ?? step;
}

function friendlyError(raw: string): string {
  if (raw.includes("ENOENT") && raw.includes(".teamagent")) {
    return "无法创建 ~/.teamagent 目录，请检查磁盘权限";
  }
  if (raw.includes("sqlite-vec") || raw.includes("extension")) {
    return "sqlite-vec 扩展加载失败。运行 teamagent doctor 诊断";
  }
  if (raw.includes("CLAUDE.md") && (raw.includes("EACCES") || raw.includes("不可读写"))) {
    return "CLAUDE.md 文件无写入权限，请运行: chmod 644 CLAUDE.md";
  }
  // For pre-check failures that already have friendly messages, pass through
  if (raw.length < 120) return raw;
  return raw.slice(0, 100) + "...";
}
