import {
  MarkdownCompiler,
  makeSkillCompiler
} from "./chunk-NAWUQDTY.js";
import {
  DualLayerStore
} from "./chunk-KGB2IXNQ.js";
import {
  runCompile
} from "./chunk-VASCS3RI.js";
import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/compile.ts
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
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
    skillsDir: opts.skillsDir
  };
}
function makeNoopSkillCompiler() {
  return {
    compile(_entries) {
      return [];
    },
    async write(_artifacts) {
      return { written: [], skipped: [] };
    },
    async cleanup(_ruleIds) {
      return { removed: [] };
    }
  };
}
function makeNoopMarkdownCompiler() {
  return {
    compile(_entries) {
      return "";
    },
    writeToFile(_entries) {
      return { filePath: "(skipped)", blockLineCount: 0, blockStartLine: 0 };
    }
  };
}
async function executeCompile(opts = {}) {
  const paths = resolvePaths(opts);
  fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
  const store = new DualLayerStore({
    projectDbPath: paths.projectDbPath,
    userGlobalDbPath: paths.userGlobalDbPath
  });
  const markdownCompiler = opts.skillsOnly ? makeNoopMarkdownCompiler() : new MarkdownCompiler(
    paths.claudeMdPath,
    opts.presetOnly ? { compileOptions: { presetOnly: true } } : void 0
  );
  const skillCompiler = opts.markdownOnly ? makeNoopSkillCompiler() : makeSkillCompiler({ skillsDir: paths.skillsDir });
  try {
    const result = await runCompile({
      store,
      markdownCompiler,
      skillCompiler,
      dryRun: opts.dryRun
    });
    return result;
  } finally {
    store.close();
  }
}
function parseCompileArgs(argv) {
  const opts = {};
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skills-only") opts.skillsOnly = true;
    else if (a === "--markdown-only") opts.markdownOnly = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--preset-only") opts.presetOnly = true;
  }
  return opts;
}
function renderCompileResult(result, dryRun = false) {
  const lines = [];
  const tag = dryRun ? " (dry-run)" : "";
  lines.push(`\u{1F527} TeamAgent Compile${tag}`);
  lines.push("");
  if (result.markdown.path === "(skipped)") {
    lines.push("  CLAUDE.md    (skipped)");
  } else if (result.markdown.path === "(dry-run)") {
    lines.push("  CLAUDE.md    (dry-run, \u672A\u5199\u5165)");
  } else {
    lines.push(
      `  CLAUDE.md    ${result.markdown.path}  (${result.markdown.blockLineCount} lines)`
    );
  }
  lines.push("");
  if (result.skills.written.length > 0 || dryRun) {
    const writeLabel = dryRun ? "would write" : "written";
    lines.push(`  Skills ${writeLabel}:  ${result.skills.written.length} \u6761`);
    for (const id of result.skills.written.slice(0, 10)) {
      lines.push(`    + ${id}`);
    }
    if (result.skills.written.length > 10) {
      lines.push(`    ... (${result.skills.written.length - 10} more)`);
    }
  } else {
    lines.push("  Skills written:  0 \u6761");
  }
  if (result.skills.removed.length > 0) {
    lines.push(`  Skills removed: ${result.skills.removed.length} \u6761`);
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

export {
  executeCompile,
  parseCompileArgs,
  renderCompileResult
};
