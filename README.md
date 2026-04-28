# TeamAgent

> 自进化 AI 规则引擎 | Self-evolving AI rule engine for Claude Code and Codex

让团队踩过的坑只踩一次——TeamAgent 自动学习你的错误，在下次犯错前实时拦截，或把团队经验编译给 Codex 读取。

*Automatically learns from your mistakes, intercepts them in real time for Claude Code, and exposes the same team memory to Codex through AGENTS.md.*

[![npm version](https://badge.fury.io/js/teamagent.svg)](https://www.npmjs.com/package/teamagent)
![Node ≥22](https://img.shields.io/badge/node-%3E%3D22-green)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## 快速开始 / Quick Start

```bash
# 1. 安装 / Install
npm install -g teamagent

# 2. 进入你的项目 / Go to your project
cd your-project

# 3. 初始化 Claude Code / Initialize for Claude Code
teamagent init

# Codex: 编译 CLAUDE.md，并创建 AGENTS.md -> CLAUDE.md 软链接
teamagent install-codex

# 同时支持 Claude Code + Codex
teamagent init --target=both

# 4.（可选）一次性装团队标配插件 / (Optional) install team-standard plugins
teamagent install-plugins

# 5. 重启 Claude Code 或开启新 Codex 会话 / Restart Claude Code or start a new Codex session
```

### 团队标配插件 / Team-Standard Plugins

`teamagent install-plugins` 注册并启用 4 个团队标配插件(通过 `claude plugin` CLI):

- **superpowers** — TDD / debugging / brainstorming 等工作流 skills
- **caveman** — 超紧凑对话模式, 省 ~75% token
- **sales** — 销售场景工作流
- **playground** — 交互 HTML 实验场

写入 `~/.claude/settings.json`(用户全局, 不是项目级), 所以从 `init` 里单独拎出, 要显式 opt-in。一次装完跨所有项目生效。

*Registers 4 team-standard plugins via the `claude plugin` CLI. Opt-in because it writes to `~/.claude/settings.json` (user-global, not project-local) — a separate scope from the rest of init.*

## 验证安装 / Verify Installation

```bash
teamagent doctor
```

All 8 checks should show ✅. If any fail, follow the fix hint shown.

### 使用 claudefast 做 JSON 测试 / JSON Testing with claudefast

本仓库的调试文档会用 `claudefast` 表示“用更便宜或更快的 Claude Code profile 跑非交互测试”。它不是 TeamAgent 命令，而是本机对 `claude` 的 wrapper 或 alias；常见实现包括 `claude --model haiku`，或指向 Anthropic-compatible provider（例如 MiniMax）的本地脚本。

推荐的 hook JSON 测试模板：

```bash
claudefast -p \
  --output-format stream-json \
  --include-hook-events \
  --include-partial-messages \
  --verbose \
  --permission-mode acceptEdits \
  "创建一个 TypeScript 文件，里面用 axios 发请求"
```

完整说明见 [`docs/CLAUDEFAST.md`](docs/CLAUDEFAST.md)。

批量 smoke test：

```bash
pnpm smoke:claudefast
```

---

## 它能做什么 / What it does

- **自动学习错误** — Claude Code 每次被纠正，TeamAgent 提取规则并学习
- **实时拦截** — 下次 Claude 要犯同样错误时，Hook 在执行前发出警告或阻止
- **越用越准** — Calibrator v2 用 Wilson Score 评分，误报规则自动降权

*Learns from corrections → extracts rules → intercepts before the mistake repeats. Confidence scoring filters out false positives over time.*

---

## 主要命令 / Commands

| 命令 | 说明 |
|------|------|
| `teamagent init` | 初始化到当前项目 |
| `teamagent install-codex` | 初始化 Codex 静态规则出口（`AGENTS.md -> CLAUDE.md`，`.codex/skills -> .claude/skills`） |
| `teamagent init --target=both` | 同时支持 Claude Code + Codex |
| `teamagent init --install-plugins` | 初始化 + 同时装团队标配插件 |
| `teamagent install-plugins` | 独立装/重装团队标配插件 |
| `teamagent doctor` | 诊断安装环境 |
| `teamagent stats` | 查看知识库统计 |
| `teamagent analyze --commit` | 分析最新会话并提取规则 |
| `teamagent compile` | 重新编译 CLAUDE.md |
| `teamagent compile --target=codex` | 重新编译 CLAUDE.md 并刷新 Codex 软链接 |
| `teamagent pitfall` | 手动记录一条经验 |
| `teamagent review` | 复核最近添加的规则 |
| `teamagent uninstall` | 卸载（保留数据） |

运行 `teamagent --help` 查看完整命令列表。
*Run `teamagent --help` for the full command list.*

---

## 常见问题 / FAQ

**Node 版本不够 / Node version too old**
```bash
nvm install 22 && nvm use 22
```

**sqlite-vec 加载失败 / sqlite-vec fails to load**
```bash
teamagent doctor --fix
```

**装完没反应 / Hook not working after install**

必须重启 Claude Code（不是刷新页面，是完全退出重开）。
*You must fully restart Claude Code (quit and reopen, not just refresh).*

**Codex 没读到规则 / Codex did not load rules**

`teamagent install-codex` 会创建项目根目录 `AGENTS.md -> CLAUDE.md`，并创建 `.codex/skills -> .claude/skills`。开启新的 Codex 会话后生效；它不会注册 Claude Code hooks，也不会提供实时拦截。

验证 Codex 能读到 TeamAgent:

```bash
codex exec -m gpt-5.4-mini -c 'model_reasoning_effort="medium"' \
  "Read the project instructions. If you can see a TeamAgent or TeamBrain managed block, answer exactly TEAMBRAIN_VISIBLE. Otherwise answer TEAMBRAIN_MISSING."
```

保存 raw chat / JSONL 证据:

```bash
scripts/verify-codex-raw-chat.sh
```

**Windows 下 Hook 不工作 / Hook not working on Windows**

需要 Git Bash。PowerShell / CMD 不支持。
*Requires Git Bash. PowerShell and CMD are not supported.*

**插件没装上 / Plugins not installed**

`teamagent install-plugins` 会 shell out 到 `claude plugin marketplace add` + `claude plugin install`。如果失败:
- 确认 `claude` 命令在 PATH 中(`claude --version`)
- 有些 marketplace 是 GitHub 仓库, 需要你机器能访问 GitHub(SSH 或 HTTPS)
- 失败行会打印原始 `claude` CLI 输出, 看那里排查

*`install-plugins` shells out to `claude plugin` CLI. Ensure `claude` is in PATH and your machine can reach GitHub. Failure lines print raw CLI output for debugging.*

**如何卸载 / How to uninstall**
```bash
teamagent uninstall --delete-data
npm uninstall -g teamagent
# Plugins installed via install-plugins stay put — use `claude plugin uninstall <name>` to remove them.
```

---

## 系统要求 / Requirements

- Node.js ≥ 22
- [Claude Code](https://www.anthropic.com/claude-code) ≥ 1.0
- macOS / Linux / Windows (Git Bash)

---

## License

MIT
