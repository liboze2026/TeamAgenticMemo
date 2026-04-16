#!/usr/bin/env node
/**
 * PostToolUse Hook 入口 (v2 — Claude Agent SDK 版)
 *
 * 读 stdin JSON → createPostToolUseHandler → 落盘 hook-post.result 事件
 * 任何异常都退化为 exit 0（不阻断工作流）
 */
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  normalizeCwd,
  createPostToolUseHandler,
  SqliteEventLog,
  openDb,
} from "@teamagent/adapters";

async function readStdinJson(): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function main(): Promise<void> {
  let input: any;
  try {
    input = await readStdinJson();
  } catch (err) {
    process.stderr.write(`teamagent post-hook: stdin read/parse failed: ${String(err)}\n`);
    process.exit(0);
  }

  if (!input) {
    process.exit(0);
  }

  try {
    const cwd = normalizeCwd(input.cwd ?? process.cwd());
    void cwd; // cwd not needed for post-hook currently

    const eventsDbPath = path.join(os.homedir(), ".teamagent", "events.db");
    fs.mkdirSync(path.dirname(eventsDbPath), { recursive: true });
    const eventLog = new SqliteEventLog(openDb(eventsDbPath));

    const handler = createPostToolUseHandler({ eventLog });
    const result = await handler(input);

    eventLog.close();

    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`teamagent post-hook: handler error: ${String(err)}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  process.stderr.write(`teamagent post-hook: unexpected: ${String(err)}\n`);
  process.exit(0);
});
