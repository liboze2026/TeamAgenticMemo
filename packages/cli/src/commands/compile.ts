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
  /** 只写 CLAUDE.md，跳过 skills 出口 */
  markdownOnly?: boolean;
  /** 只写 skills，跳过 CLAUDE.md */
  skillsOnly?: boolean;
  /** 强制重写（当前实现：默认就是幂等重写，此 flag 预留） */
  force?: boolean;
  // 路径注入，供测试使用
  cwd?: string;
  homeDir?: string;
  claudeMdPath?: string;
  skillsDir?: string;
  projectDbPath?: string;
  userGlobalDbPath?: string;
}

function resolvePaths(opts: CompileOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    projectDbPath:
      opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath:
      opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
    skillsDir: opts.skillsDir,
  };
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

export async function executeCompile(opts: CompileOptions = {}): Promise<CompilePipelineResult> {
  const paths = resolvePaths(opts);

  fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });

  const store = new DualLayerStore({
    projectDbPath: paths.projectDbPath,
    userGlobalDbPath: paths.userGlobalDbPath,
  });

  const markdownCompiler = opts.skillsOnly
    ? makeNoopMarkdownCompiler()
    : new MarkdownCompiler(paths.claudeMdPath);

  const skillCompiler = opts.markdownOnly
    ? makeNoopSkillCompiler()
    : makeSkillCompiler({ skillsDir: paths.skillsDir });

  try {
    const result = await runCompile({
      store,
      markdownCompiler,
      skillCompiler,
      dryRun: opts.dryRun,
    });
    return result;
  } finally {
    store.close();
  }
}

export function parseCompileArgs(argv: string[]): CompileOptions {
  const opts: CompileOptions = {};
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skills-only") opts.skillsOnly = true;
    else if (a === "--markdown-only") opts.markdownOnly = true;
    else if (a === "--force") opts.force = true;
  }
  return opts;
}

export function renderCompileResult(
  result: CompilePipelineResult,
  dryRun = false,
): string {
  const lines: string[] = [];
  const tag = dryRun ? " (dry-run)" : "";
  lines.push(`🔧 TeamAgent Compile${tag}`);
  lines.push("");

  if (result.markdown.path === "(skipped)") {
    lines.push("  CLAUDE.md    (skipped)");
  } else if (result.markdown.path === "(dry-run)") {
    lines.push("  CLAUDE.md    (dry-run, 未写入)");
  } else {
    lines.push(
      `  CLAUDE.md    ${result.markdown.path}  (${result.markdown.blockLineCount} lines)`,
    );
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
