# TeamAgent

> 自进化 AI 规则引擎 | Self-evolving AI rule engine for Claude Code

让团队踩过的坑只踩一次——TeamAgent 自动学习你的错误，在下次犯错前实时拦截。

*Automatically learns from your mistakes and intercepts them in real time — so your team only falls into each pitfall once.*

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

# 3. 初始化 / Initialize
teamagent init

# 4. 重启 Claude Code，开始使用 / Restart Claude Code — hooks are now active
```

## 验证安装 / Verify Installation

```bash
teamagent doctor
```

All 8 checks should show ✅. If any fail, follow the fix hint shown.

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
| `teamagent doctor` | 诊断安装环境 |
| `teamagent stats` | 查看知识库统计 |
| `teamagent analyze --commit` | 分析最新会话并提取规则 |
| `teamagent compile` | 重新编译 CLAUDE.md |
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

**Windows 下 Hook 不工作 / Hook not working on Windows**

需要 Git Bash。PowerShell / CMD 不支持。
*Requires Git Bash. PowerShell and CMD are not supported.*

**如何卸载 / How to uninstall**
```bash
teamagent uninstall --delete-data
npm uninstall -g teamagent
```

---

## 系统要求 / Requirements

- Node.js ≥ 22
- [Claude Code](https://www.anthropic.com/claude-code) ≥ 1.0
- macOS / Linux / Windows (Git Bash)

---

## License

MIT
