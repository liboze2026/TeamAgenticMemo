import fs from "node:fs";
import path from "node:path";
import {
  compileMarkdownBlock,
  injectBlockIntoDoc,
  BLOCK_START,
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

/**
 * CLAUDE.md 的 Markdown Compiler adapter。
 *
 * - `compile(entries)`: 纯函数，只返回区块字符串（无 IO）
 * - `writeToFile(entries)`: 把区块注入到真实 CLAUDE.md，保留用户区块外内容
 *
 * 实现原则（Ports & Adapters）：
 * 编译逻辑在 core（纯函数），adapter 只做 IO 包装。
 */
export class MarkdownCompiler implements Compiler<string> {
  constructor(
    private readonly mdPath: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** 纯函数：编译为区块字符串，不触碰文件系统。 */
  compile(entries: KnowledgeEntry[]): string {
    return compileMarkdownBlock(entries, this.now());
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
