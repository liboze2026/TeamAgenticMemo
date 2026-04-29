import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  DualLayerStore,
  MarkdownCompiler,
  makeSkillCompiler,
} from "@teamagent/adapters";
import { runCompile, type CompilePipelineResult } from "@teamagent/core";
import type { SkillCompiler, SkillArtifact } from "@teamagent/ports";
import type { KnowledgeEntry } from "@teamagent/types";

export interface CompileOptions {
  dryRun?: boolean;
  /** Markdown target. Defaults to historical CLAUDE.md output. */
  target?: "claude" | "codex" | "both";
  /** 只写 CLAUDE.md，跳过 skills 出口 */
  markdownOnly?: boolean;
  /** 只写 skills，跳过 CLAUDE.md */
  skillsOnly?: boolean;
  /** 强制重写（当前实现：默认就是幂等重写，此 flag 预留） */
  force?: boolean;
  /** 编译元原则模式：只输出 source='preset' 的条目 */
  presetOnly?: boolean;
  // 路径注入，供测试使用
  cwd?: string;
  homeDir?: string;
  claudeMdPath?: string;
  agentsMdPath?: string;
  skillsDir?: string;
  projectDbPath?: string;
  userGlobalDbPath?: string;
}

export type CompileCommandResult = CompilePipelineResult & {
  agentsMarkdown?: { path: string; blockLineCount: number };
};

function resolvePaths(opts: CompileOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  const teamagentSkillsDir =
    opts.skillsDir ??
    process.env["TEAMAGENT_SKILLS_DIR"] ??
    path.join(home, ".claude", "skills", "teamagent");
  return {
    projectDbPath:
      opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath:
      opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
    agentsMdPath: opts.agentsMdPath ?? path.join(cwd, "AGENTS.md"),
    skillsDir: opts.skillsDir,
    teamagentSkillsDir,
    codexSkillsDir: path.join(cwd, ".codex", "skills"),
  };
}

function targetIncludesClaude(target: NonNullable<CompileOptions["target"]>): boolean {
  return target === "claude" || target === "both";
}

function targetIncludesCodex(target: NonNullable<CompileOptions["target"]>): boolean {
  return target === "codex" || target === "both";
}

/** 不做任何写操作的 SkillCompiler stub（用于 --markdown-only 模式）。 */
function makeNoopSkillCompiler(): SkillCompiler {
  return {
    compile(_entries: KnowledgeEntry[]): SkillArtifact[] {
      return [];
    },
    async write(_artifacts: SkillArtifact[]) {
      return { written: [], skipped: [] };
    },
    async cleanup(_ruleIds: string[]) {
      return { removed: [] };
    },
  };
}

/** 不做任何写操作的 MarkdownCompiler stub（用于 --skills-only 模式）。 */
function makeNoopMarkdownCompiler() {
  return {
    compile(_entries: KnowledgeEntry[]): string {
      return "";
    },
    writeToFile(_entries: KnowledgeEntry[]) {
      return { filePath: "(skipped)", blockLineCount: 0, blockStartLine: 0 };
    },
  };
}

export async function executeCompile(opts: CompileOptions = {}): Promise<CompileCommandResult> {
  const paths = resolvePaths(opts);
  const target = opts.target ?? "claude";

  fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });

  const store = new DualLayerStore({
    projectDbPath: paths.projectDbPath,
    userGlobalDbPath: paths.userGlobalDbPath,
  });

  const primaryMarkdownPath = paths.claudeMdPath;

  const markdownCompiler = opts.skillsOnly
    ? makeNoopMarkdownCompiler()
    : new MarkdownCompiler(
        primaryMarkdownPath,
        opts.presetOnly ? { compileOptions: { presetOnly: true } } : undefined,
      );

  const shouldWriteSkills =
    !opts.markdownOnly && (targetIncludesClaude(target) || targetIncludesCodex(target));
  const skillCompiler = shouldWriteSkills
    ? makeSkillCompiler({ skillsDir: paths.teamagentSkillsDir })
    : makeNoopSkillCompiler();

  try {
    const result: CompileCommandResult = await runCompile({
      store,
      markdownCompiler,
      skillCompiler,
      dryRun: opts.dryRun,
    });
    if (targetIncludesCodex(target) && !opts.skillsOnly) {
      if (opts.dryRun) {
        result.agentsMarkdown = { path: "(dry-run)", blockLineCount: 0 };
      } else {
        fs.mkdirSync(paths.teamagentSkillsDir, { recursive: true });
        ensureSymlink(paths.agentsMdPath, paths.claudeMdPath, "file", () => new Date());
        ensureSymlink(paths.codexSkillsDir, paths.teamagentSkillsDir, "dir", () => new Date());
        result.agentsMarkdown = {
          path: paths.agentsMdPath,
          blockLineCount: result.markdown.blockLineCount,
        };
      }
    }
    return result;
  } finally {
    store.close();
  }
}

function ensureSymlink(
  linkPath: string,
  targetPath: string,
  targetType: "file" | "dir",
  now: () => Date,
): "created" | "already" | "backed-up" {
  const relativeTarget = path.relative(path.dirname(linkPath), targetPath) || path.basename(targetPath);
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const current = fs.readlinkSync(linkPath);
      const currentAbs = path.resolve(path.dirname(linkPath), current);
      if (currentAbs === targetPath) return "already";
      fs.unlinkSync(linkPath);
    } else {
      const backupPath = `${linkPath}.bak-teamagent-${now().toISOString().replace(/[:.]/g, "-")}`;
      fs.renameSync(linkPath, backupPath);
      fs.symlinkSync(relativeTarget, linkPath, targetType === "dir" ? "junction" : "file");
      return "backed-up";
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(relativeTarget, linkPath, targetType === "dir" ? "junction" : "file");
  return "created";
}

export function parseCompileArgs(argv: string[]): CompileOptions {
  const opts: CompileOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skills-only") opts.skillsOnly = true;
    else if (a === "--markdown-only") opts.markdownOnly = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--preset-only") opts.presetOnly = true;
    else if (a === "--codex") opts.target = "codex";
    else if (a === "--claude") opts.target = "claude";
    else if (a === "--both") opts.target = "both";
    else if (a === "--target") {
      opts.target = parseTarget(argv[++i]);
    } else if (a.startsWith("--target=")) {
      opts.target = parseTarget(a.slice("--target=".length));
    }
  }
  return opts;
}

function parseTarget(value: string | undefined): NonNullable<CompileOptions["target"]> {
  if (value === "claude" || value === "codex" || value === "both") return value;
  throw new Error(`--target 必须是 claude|codex|both，收到: ${value ?? ""}`);
}

export function renderCompileResult(
  result: CompileCommandResult,
  dryRun = false,
): string {
  const lines: string[] = [];
  const tag = dryRun ? " (dry-run)" : "";
  lines.push(`🔧 TeamAgent Compile${tag}`);
  lines.push("");

  const label =
    result.markdown.path === "(skipped)" || result.markdown.path === "(dry-run)"
      ? "Markdown"
      : path.basename(result.markdown.path);
  if (result.markdown.path === "(skipped)") {
    lines.push(`  ${label.padEnd(12)}(skipped)`);
  } else if (result.markdown.path === "(dry-run)") {
    lines.push(`  ${label.padEnd(12)}(dry-run, 未写入)`);
  } else {
    lines.push(
      `  ${label.padEnd(12)}${result.markdown.path}  (${result.markdown.blockLineCount} lines)`,
    );
  }
  if (result.agentsMarkdown) {
    if (result.agentsMarkdown.path === "(dry-run)") {
      lines.push("  AGENTS.md   (dry-run, 未写入)");
    } else {
      lines.push(
        `  AGENTS.md   ${result.agentsMarkdown.path}  (${result.agentsMarkdown.blockLineCount} lines)`,
      );
    }
  }

  lines.push("");

  if (result.skills.written.length > 0 || dryRun) {
    const writeLabel = dryRun ? "would write" : "written";
    lines.push(`  Skills ${writeLabel}:  ${result.skills.written.length} 条`);
    for (const id of result.skills.written.slice(0, 10)) {
      lines.push(`    + ${id}`);
    }
    if (result.skills.written.length > 10) {
      lines.push(`    ... (${result.skills.written.length - 10} more)`);
    }
  } else {
    lines.push("  Skills written:  0 条");
  }

  if (result.skills.removed.length > 0) {
    lines.push(`  Skills removed: ${result.skills.removed.length} 条`);
    for (const id of result.skills.removed.slice(0, 10)) {
      lines.push(`    - ${id}`);
    }
    if (result.skills.removed.length > 10) {
      lines.push(`    ... (${result.skills.removed.length - 10} more)`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
