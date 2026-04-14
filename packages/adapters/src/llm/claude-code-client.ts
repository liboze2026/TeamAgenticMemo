import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import type { LLMClient } from "@teamagent/ports";
import { LLMClientError } from "@teamagent/ports";

/**
 * Spawn 抽象：便于测试时注入 fake spawner。
 * 返回值只暴露测试需要的最小表面。
 */
export interface Spawner {
  (
    command: string,
    args: string[],
    options: { timeoutMs: number; input: string },
  ): Promise<SpawnResult>;
}

export type SpawnResult =
  | { kind: "exit"; code: number; stdout: string; stderr: string }
  | { kind: "timeout" }
  | { kind: "enoent" }
  | { kind: "error"; message: string };

export interface ClaudeCodeLLMClientOptions {
  /** 可执行文件名或绝对路径，默认 'claude'。 */
  executable?: string;
  /** 超时毫秒，默认 30000。 */
  timeoutMs?: number;
  /** 注入 spawner，默认用真实 node:child_process spawn。 */
  spawner?: Spawner;
}

/**
 * 通过 spawn 本机 `claude -p ... --output-format json` 来调 LLM。
 *
 * 不需 API Key——复用用户已有 Claude Code 订阅。这是 Phase 1 唯一的 LLM adapter。
 *
 * 响应格式（--output-format json）:
 *   { "type": "result", "subtype": "success", "is_error": false,
 *     "result": "<the actual completion text>", ... }
 *
 * 行为契约：参见 packages/ports/src/__tests__/llm-client-contract.ts
 */
export class ClaudeCodeLLMClient implements LLMClient {
  private readonly executable: string;
  private readonly timeoutMs: number;
  private readonly spawner: Spawner;

  constructor(opts: ClaudeCodeLLMClientOptions = {}) {
    this.executable = opts.executable ?? "claude";
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.spawner = opts.spawner ?? defaultSpawner;
  }

  async complete(prompt: string): Promise<string> {
    const args = [
      "-p",
      // prompt 通过 stdin 传入，避免 Windows 命令行长度 / 转义问题
      "--output-format",
      "json",
      "--no-session-persistence",
    ];
    const result = await this.spawner(this.executable, args, {
      timeoutMs: this.timeoutMs,
      input: prompt,
    });

    switch (result.kind) {
      case "enoent":
        throw new LLMClientError(
          "not-installed",
          `未找到 '${this.executable}' 可执行文件。请先安装 Claude Code 并确保在 PATH 中。`,
        );
      case "timeout":
        throw new LLMClientError(
          "timeout",
          `Claude CLI 调用超时（${this.timeoutMs}ms）。`,
        );
      case "error":
        throw new LLMClientError(
          "unknown",
          `Claude CLI 进程启动失败: ${result.message}`,
        );
      case "exit": {
        if (result.code !== 0) {
          throw new LLMClientError(
            "non-zero-exit",
            `Claude CLI exit ${result.code}: ${result.stderr.slice(0, 500)}`,
          );
        }
        return parseClaudeJsonOutput(result.stdout);
      }
    }
  }
}

/**
 * 解析 `claude -p --output-format json` 的 stdout。
 * 返回 .result 字段的字符串；异常时抛 LLMClientError("unparseable-output")。
 */
export function parseClaudeJsonOutput(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new LLMClientError("unparseable-output", "Claude CLI 返回空输出。");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new LLMClientError(
      "unparseable-output",
      `Claude CLI 返回不是合法 JSON: ${trimmed.slice(0, 200)}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new LLMClientError("unparseable-output", "响应不是 object。");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.is_error === true) {
    throw new LLMClientError(
      "non-zero-exit",
      `Claude CLI is_error=true: ${String(obj.result ?? obj.error ?? "unknown")}`,
    );
  }
  if (typeof obj.result !== "string") {
    throw new LLMClientError(
      "unparseable-output",
      `响应缺 .result 字段或不是 string: ${trimmed.slice(0, 200)}`,
    );
  }
  return obj.result;
}

/** 默认的真实 spawner，基于 node:child_process。 */
const defaultSpawner: Spawner = (command, args, options) => {
  return new Promise<SpawnResult>((resolve) => {
    let child: ChildProcess;
    try {
      child = nodeSpawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
    } catch (err) {
      resolve({ kind: "error", message: String(err) });
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve({ kind: "timeout" });
    }, options.timeoutMs);

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        resolve({ kind: "enoent" });
      } else {
        resolve({ kind: "error", message: err.message });
      }
    });

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ kind: "exit", code: code ?? 0, stdout, stderr });
    });

    child.stdin?.write(options.input);
    child.stdin?.end();
  });
};
