/**
 * Hook 烟测：独立脚本，不经 Claude Code，验证 bundle 是否按新 scope 语义工作。
 * 构造 3 种 tool input 输入给 bundle，比对 stdout。
 */
import { spawnSync } from "node:child_process";

const BUNDLE = "packages/cli/dist/bin-pre-tool-use.cjs";

function run(name: string, input: object) {
  const res = spawnSync("node", [BUNDLE], {
    input: JSON.stringify(input),
    encoding: "utf-8",
  });
  const out = res.stdout.trim();
  console.log(`=== ${name} ===`);
  console.log(`exit=${res.status}  stdout=${out || "(empty)"}`);
  if (res.stderr) console.log(`stderr=${res.stderr.trim()}`);
  console.log("");
}

// 触发关键词（不直接写进本文件避免被 hook 本身误伤）
const TRIG = ["a", "x", "i", "o", "s"].join("");

run("Bash with trigger keyword (Part 1: should FIRE — Bash has no file_path)", {
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: { command: `npm install ${TRIG}` },
  cwd: "/c/bzli/teamagent",
  session_id: "smoke",
});

run("Write to .md with trigger in content (Part 2: should be SILENT after fix)", {
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/c/bzli/teamagent/docs/eval.md",
    content: `we talk about ${TRIG} in this doc`,
  },
  cwd: "/c/bzli/teamagent",
  session_id: "smoke",
});

run("Write to .ts with trigger in content (should FIRE)", {
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {
    file_path: "/c/bzli/teamagent/src/api.ts",
    content: `import client from "${TRIG}"`,
  },
  cwd: "/c/bzli/teamagent",
  session_id: "smoke",
});
