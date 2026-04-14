import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  JsonlKnowledgeStore,
  MarkdownCompiler,
  ClaudeCodeLLMClient,
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
  personalPath?: string;
  globalPath?: string;
  teamPath?: string;
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

/** 统一返回路径集合，测试可全覆盖。 */
function resolvePaths(opts: InitOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    home,
    cwd,
    personalPath:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    teamPath: opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    globalPath:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
    installLogPath: path.join(home, ".teamagent", ".install-log"),
  };
}

/** 只读 FilePresence（detect-stack 用）。cwd 下的相对路径。 */
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

/** init 主入口。Phase A 预检 → Phase B 执行 → 每步结果记录。 */
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

  // Step 1: detect-stack
  const stackStep = doDetectStack(paths.cwd);
  steps.push(stackStep);
  const stackSummary = stackStep.detail;

  // Step 2: create directories
  steps.push(doCreateDirs(paths, dryRun));

  // Step 3: load meta-principles into global store
  const presetStep = doLoadPresets(paths.globalPath, dryRun, now);
  steps.push(presetStep.step);

  // Step 4 + 5: scan existing rules + structure via LLM into personal store
  const importStep = await doImportRules(paths, opts, dryRun, now);
  steps.push(...importStep.steps);

  // Step 6: install hook
  if (!opts.skipHook) {
    steps.push(doInstallHook(paths.cwd, opts.hookEntry, dryRun));
  } else {
    steps.push({ step: "install-hook", status: "skipped", detail: "skipHook=true" });
  }

  // Step 7: compile CLAUDE.md
  const compileStep = doCompileClaudeMd(paths, dryRun, now);
  steps.push(compileStep);

  // Step 8: install-log 追加（不算核心步骤，失败只 warn）
  if (!dryRun) {
    try {
      appendInstallLog(paths.installLogPath, steps, now);
    } catch {
      // ignore
    }
  }

  const totalActive = dryRun
    ? presetStep.wouldAddCount + importStep.wouldImport
    : countActive([paths.personalPath, paths.teamPath, paths.globalPath]);
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
  // 1. cwd 存在
  if (!fs.existsSync(paths.cwd)) {
    return failStep("pre-check", `cwd 不存在: ${paths.cwd}`);
  }
  // 2. home 可写（尝试创建 ~/.teamagent）
  try {
    const tDir = path.join(paths.home, ".teamagent");
    fs.mkdirSync(tDir, { recursive: true });
    // 写一个 probe 文件再删，验证权限
    const probe = path.join(tDir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
  } catch (err) {
    return failStep("pre-check", `~/.teamagent 不可写: ${String(err).slice(0, 200)}`);
  }
  // 3. 若 CLAUDE.md 存在，必须可读可写
  if (fs.existsSync(paths.claudeMdPath)) {
    try {
      fs.accessSync(paths.claudeMdPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      return failStep("pre-check", `CLAUDE.md 不可读写: ${paths.claudeMdPath}`);
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
    path.dirname(paths.personalPath),
    path.dirname(paths.globalPath),
    path.dirname(paths.teamPath),
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
  globalPath: string,
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
    const store = new JsonlKnowledgeStore(globalPath);
    let added = 0;
    for (const p of presets) {
      if (store.getById(p.id)) continue; // 幂等：已有同 id 跳过
      store.add(p);
      added++;
    }
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

  // Step 4: 扫描
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

  // Step 5: structure via LLM
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
    const store = new JsonlKnowledgeStore(paths.personalPath);
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
    // 常见失败：bundle 未构建
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
      `(dry-run) 会把三个 scope 的 active 条目合并编译到 ${paths.claudeMdPath}`,
    );
  }
  try {
    const all: KnowledgeEntry[] = [];
    for (const p of [paths.personalPath, paths.teamPath, paths.globalPath]) {
      try {
        const s = new JsonlKnowledgeStore(p);
        all.push(...s.getActive());
      } catch {
        // skip
      }
    }
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

function countActive(paths: string[]): number {
  let n = 0;
  for (const p of paths) {
    try {
      n += new JsonlKnowledgeStore(p).getActive().length;
    } catch {
      // skip
    }
  }
  return n;
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

/** 把 InitResult 渲染成用户友好的文本。 */
export function renderInitResult(r: InitResult): string {
  const lines: string[] = [];
  lines.push(r.dryRun ? "🔍 TeamAgent Init (dry-run)" : "✨ TeamAgent Init");
  lines.push("");
  for (const s of r.steps) {
    const sym = s.status === "ok" ? "✓" : s.status === "skipped" ? "-" : "✗";
    lines.push(`  ${sym} ${s.step.padEnd(22)} ${s.detail}`);
  }
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (r.ok) {
    lines.push(`  stack: ${r.summary.stack || "(未识别)"}`);
    lines.push(`  知识库: +${r.summary.presetAdded} 元原则, +${r.summary.importedRules} 导入`);
    lines.push(`  当前活跃条目: ${r.summary.totalActiveEntries} 条`);
    if (!r.dryRun) {
      lines.push("  下一步: 开 Claude Code，AI 已知这些经验");
    }
  } else {
    lines.push("  ✗ init 未完全成功。检查上面的 'failed' 步骤，可能需要手动清理。");
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n") + "\n";
}
