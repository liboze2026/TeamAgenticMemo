#!/usr/bin/env node
/**
 * Hook 入口：从 stdin 读 PreToolUseInput JSON，写 HookOutput JSON 到 stdout。
 *
 * 由 Claude Code 通过 .claude/settings.json 的 hooks.PreToolUse 配置调用。
 *
 * 设计原则：
 * - 任何异常都退化为"通过"（exit 0 + 空 stdout），不阻断用户工作流
 * - 不写 console.log（污染 stdout 协议），错误走 stderr
 * - 全部用同步 IO + 同步逻辑，避免 hook 进程死锁
 */
import { handlePreToolUse } from "@teamagent/adapters";
import type { PreToolUseInput } from "@teamagent/types";

async function main(): Promise<void> {
  let raw = "";
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch (err) {
    process.stderr.write(`teamagent hook: stdin read failed: ${String(err)}\n`);
    process.exit(0);
  }

  if (!raw.trim()) {
    process.exit(0);
  }

  let input: PreToolUseInput;
  try {
    input = JSON.parse(raw) as PreToolUseInput;
  } catch (err) {
    process.stderr.write(`teamagent hook: JSON parse failed: ${String(err)}\n`);
    process.exit(0);
  }

  const output = handlePreToolUse(input);

  // 空对象 → exit 0 不输出，让 Claude Code 默认通过
  if (Object.keys(output).length === 0) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`teamagent hook: unexpected error: ${String(err)}\n`);
  process.exit(0);
});
