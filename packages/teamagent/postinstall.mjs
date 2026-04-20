#!/usr/bin/env node
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const binPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist", "bin.js");

try {
  execSync(`node "${binPath}" doctor --postinstall`, {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15000,
  });
} catch {
  process.stderr.write(
    "\n⚠️  TeamAgent: 安装后检测发现问题，运行 teamagent doctor 查看详情\n\n"
  );
}
