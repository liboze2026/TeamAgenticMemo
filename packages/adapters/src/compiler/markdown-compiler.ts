import fs from "node:fs";
import path from "node:path";
import {
  compileMarkdownBlock,
  injectBlockIntoDoc,
  BLOCK_START,
  type CompileMarkdownOptions,
} from "@teamagent/core";
import type { Compiler } from "@teamagent/ports";
import type { KnowledgeEntry } from "@teamagent/types";

/**
 * writeToFile 的返回信息，供归因事件使用。
 */
export interface CompileWriteInfo {
  filePath: string;
  /** 生成的 TEAMAGENT 区块（含 START/END 标记）总行数 */
  blockLineCount: number;
  /** TEAMAGENT:START 在整个文件中的行号（0-indexed） */
  blockStartLine: number;
}

/** MarkdownCompiler 构造参数。 */
export interface MarkdownCompilerOptions {
  /** 当前时间 getter（默认 new Date().toISOString()） */
  now?: () => string;
  /** 编译选项，目前只含 `limit`（最大条目数） */
  compileOptions?: CompileMarkdownOptions;
}

/**
 * CLAUDE.md 的 Markdown Compiler adapter。
 *
 * - `compile(entries)`: 纯函数，只返回区块字符串（无 IO）
 * - `writeToFile(entries)`: 把区块注入到真实 CLAUDE.md，保留用户区块外内容
 *
 * 实现原则（Ports & Adapters）：
 * 编译逻辑在 core（纯函数），adapter 只做 IO 包装。
 *
 * 支持从环境变量 `TEAMAGENT_CLAUDE_MD_LIMIT` 读取条目数上限。显式传入
 * `compileOptions.limit` 优先于环境变量。
 */
export class MarkdownCompiler implements Compiler<string> {
  private readonly now: () => string;
  private readonly compileOptions: CompileMarkdownOptions;

  constructor(
    private readonly mdPath: string,
    nowOrOptions?: (() => string) | MarkdownCompilerOptions,
    legacyCompileOptions?: CompileMarkdownOptions,
  ) {
    // 兼容旧 API: new MarkdownCompiler(path, now)
    if (typeof nowOrOptions === "function" || nowOrOptions === undefined) {
      this.now = nowOrOptions ?? (() => new Date().toISOString());
      this.compileOptions = legacyCompileOptions ?? resolveOptionsFromEnv();
    } else {
      this.now = nowOrOptions.now ?? (() => new Date().toISOString());
      this.compileOptions =
        nowOrOptions.compileOptions ?? resolveOptionsFromEnv();
    }
  }

  /** 纯函数：编译为区块字符串，不触碰文件系统。 */
  compile(entries: KnowledgeEntry[]): string {
    return compileMarkdownBlock(entries, this.now(), this.compileOptions);
  }

  /**
   * 把区块写入 CLAUDE.md。保留用户在 TEAMAGENT 区块外的内容。
   * 文件不存在会被创建（同时创建父目录）。
   */
  writeToFile(entries: KnowledgeEntry[]): CompileWriteInfo {
    const dir = path.dirname(this.mdPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const existing = fs.existsSync(this.mdPath)
      ? fs.readFileSync(this.mdPath, "utf-8")
      : "";
    const block = this.compile(entries);
    const updated = injectBlockIntoDoc(existing, block);

    // 原子写
    const tmpPath = `${this.mdPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, updated, "utf-8");
    fs.renameSync(tmpPath, this.mdPath);

    const allLines = updated.split("\n");
    const startLine = allLines.findIndex((l) => l.includes(BLOCK_START));
    const blockLineCount = block.split("\n").length;

    return {
      filePath: this.mdPath,
      blockLineCount,
      blockStartLine: startLine === -1 ? 0 : startLine,
    };
  }
}

/** 从环境变量解析 compile options。非法值回退到默认。 */
function resolveOptionsFromEnv(): CompileMarkdownOptions {
  const raw = process.env.TEAMAGENT_CLAUDE_MD_LIMIT;
  if (!raw) return {};
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return {};
  return { limit: n };
}
