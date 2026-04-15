#!/usr/bin/env node
/**
 * PostToolUse Hook 入口：从 stdin 读 PostToolUseInput，关联 PreToolUse 的
 * intervention_id + knowledge_id，写 hook-post.result 事件。
 *
 * 由 Claude Code 通过 .claude/settings.json 的 hooks.PostToolUse 配置调用。
 * 设计与 bin-pre-tool-use.ts 一致：异常退化为通过，不污染 stdout。
 */
import { handlePostToolUse } from "@teamagent/adapters";
import type { PostToolUseInput } from "@teamagent/types";

async function main(): Promise<void> {
  let raw = "";
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch (err) {
    process.stderr.write(`teamagent post-hook: stdin read failed: ${String(err)}\n`);
    process.exit(0);
  }

  if (!raw.trim()) {
    process.exit(0);
  }

  let input: PostToolUseInput;
  try {
    input = JSON.parse(raw) as PostToolUseInput;
  } catch (err) {
    process.stderr.write(`teamagent post-hook: JSON parse failed: ${String(err)}\n`);
    process.exit(0);
  }

  const output = handlePostToolUse(input);

  if (Object.keys(output).length === 0) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`teamagent post-hook: unexpected error: ${String(err)}\n`);
  process.exit(0);
});
