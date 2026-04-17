# TeamAgent 系统技术文档

> 目标读者：从未接触过本项目的技术开发人员。读完本文档应能理解系统的 90%。
>
> 文档基于代码状态：2026-04-17（Phase 1 完成 + SP-2 进行中）

---

## 1. 系统定位

TeamAgent 是一个**团队 AI 自进化引擎**，以 Claude Code Hooks 为核心嵌入点，无感地运行在每个开发者的工作流背后。它解决的核心问题是：**开发者踩过的坑，AI 下次会自动避开；团队成员的经验，自动流入所有人的 AI**。不同于 CLAUDE.md 这种手写维护的静态规则文件，TeamAgent 的知识库是活的——通过纠正时刻检测、置信度校准、Tier 晋升/降级等机制，知识会随使用自动进化。当前处于 Phase 1（个人层核心），Phase 2~4 将依次引入 MCP Server 实时顾问、团队层共享、互联网层知识。

---

## 2. 核心概念词典

### KnowledgeEntry（知识条目）

知识库的最小单元，代表一条"AI 应该知道的经验"。每条知识记录了触发条件、错误模式、正确做法和置信度。

关键字段：

| 字段 | 含义 |
|------|------|
| `category` | C（代码层）/ E（工程层）/ S（策略层）/ K（认知层）——坑属于哪个层面 |
| `type` | `avoidance`（避坑：不要做 X）/ `practice`（最佳实践：做 Y） |
| `nature` | `objective`（客观可验证）/ `subjective`（主观偏好，如团队风格约定） |
| `confidence` | 0.0~1.0，表示这条知识有多可靠，由 Calibrator 根据实际命中结果自动调整 |
| `enforcement` | 由 confidence 自动推导：`block`(≥0.9) / `warn`(0.7-0.9) / `suggest`(0.5-0.7) / `passive`(<0.5) |
| `tier` | experimental → probation → stable → canonical → enforced，知识的"成熟度" |
| `scope.level` | `personal`（仅自己）/ `team`（本项目团队）/ `global`（所有项目） |
| `source` | `preset`（预置元原则）/ `imported`（从已有规则导入）/ `accumulated`（使用中积累） |

类型定义：`packages/types/src/knowledge-entry.ts`

示例：
```json
{
  "id": "team-015",
  "scope": { "level": "personal" },
  "category": "E",
  "tags": ["tech-choice", "state-management"],
  "type": "avoidance",
  "nature": "subjective",
  "trigger": "状态管理方案选择",
  "wrong_pattern": "引入 Redux/MobX",
  "correct_pattern": "使用 Zustand",
  "confidence": 0.82,
  "enforcement": "warn",
  "current_tier": "stable"
}
```

### DualLayerStore（双层知识存储）

TeamAgent 当前将知识分两个 SQLite 数据库存储，而非一个，原因是：**个人知识和全局知识有不同的生命周期和隐私边界**。

- **project 层**（`personal` scope）：存于 `{project}/.teamagent/knowledge.db`，项目专属的个人知识。
- **global 层**（`global` scope）：存于 `~/.teamagent/global.db`，跨所有项目生效的机器环境知识（如"本机 python3 指向 python3，不是 python"）。

查询时两层合并返回，写入时按 `scope.level` 自动路由到正确的 DB。`team` scope 目前抛错，留待 Phase 4 实现。

实现：`packages/adapters/src/storage/sqlite/dual-layer-store.ts`

数据库物理位置：
```
~/.teamagent/
  global.db        ← scope.level=global 的知识
  events.db        ← 所有事件日志（hook 命中、校准事件等）

{project}/.teamagent/
  knowledge.db     ← scope.level=personal 的知识 + wiki_meta + 候选规则
```

### Hook（Claude Code 钩子）

Claude Code 提供了一个 Hook 机制：在特定生命周期节点（工具调用前后、会话结束等），向注册的外部进程发送 stdin JSON，并读取该进程 stdout 返回的 JSON 来决定是否阻断或注入信息。TeamAgent 注册了 4 个 Hook：

| Hook 类型 | 触发时机 | TeamAgent 的用途 |
|-----------|---------|-----------------|
| `PreToolUse` | AI 每次调用 Bash/Write/Edit/WebFetch 之前 | 匹配知识库规则，命中则注入警告或阻断 |
| `PostToolUse` | 工具执行完成后 | 记录执行结果到 `events.db`，为后续置信度校准提供反馈数据 |
| `UserPromptSubmit` | 用户每次提交 prompt 时 | 从 wiki 知识库检索相关条目，注入到上下文（Inline Wiki Injection） |
| `Stop` | 会话结束时 | 依次执行 analyze→calibrate→compile 三阶段流水线，自动更新知识库和 CLAUDE.md |

Hook 注册配置：`.claude/settings.local.json`（本地机器，不入 git）

### AttributionBus（归因总线）

组件不直接调用 `console.log`，而是通过 `bus.emit(event)` 发送结构化 `AttributionEvent`，由 `StdoutRenderer` 统一渲染给用户。

**为什么这么设计**：
1. 支持 `silent/smart/verbose` 三种显示模式——`smart` 模式只在系统真正帮到用户时显示提示，避免噪音
2. 结构化事件便于测试（用 `InMemoryAttributionBus` 断言事件），而不是匹配字符串输出
3. 每个事件携带 `userFacingValue`（有感价值）和 `counterfactual`（反事实），`verbose` 模式下可展示完整决策链

接口：`packages/ports/src/attribution-bus.ts`
实现：`packages/adapters/src/attribution/in-memory-bus.ts` 和 `stdout-renderer.ts`
类型：`packages/types/src/attribution.ts`

### WikiEntry（前沿知识条目）

WikiEntry 是通过 `teamagent wiki:pull` 从外部源（GitHub Releases、npm 更新日志、RSS、arXiv 等）拉取的**前沿技术知识**，存储在 `knowledge.db` 的 `wiki_meta` 表中，关联到 `knowledge` 主表。

与 KnowledgeEntry 的区别：
- KnowledgeEntry 来自用户实际开发中的经验积累（纠正时刻、手动录入等）
- WikiEntry 来自互联网信息源，经 AI（claude-haiku）判断价值后入库，附有向量嵌入（384 维），通过 `UserPromptSubmit` Hook 在用户每次提问时做语义匹配，自动注入相关前沿知识
- WikiEntry 有 `tldr`、`keywords`、`source_url`、`user_thumbs_down` 等专属字段

Wiki 系统：`packages/core/src/wiki/`，`packages/adapters/src/wiki/`

### Calibration（置信度校准）

校准是指根据知识被实际应用的结果，自动调整其 `confidence` 值的过程。每次 Hook 命中一条知识规则后，事件落盘到 `events.db`；会话结束的 `Stop` Hook 触发 `teamagent calibrate` 重算。

校准规则（节选）：

| 事件 | confidence 变化 |
|------|----------------|
| 干预成功（建议被采纳且执行成功） | +0.05 |
| 用户显式确认有效 | +0.10 |
| 用户 override（绕过规则） | −0.15 |
| 干预后仍失败 | −0.10 |
| 超过 90 天未命中 | −0.05（被动衰减） |

核心算法：`packages/core/src/calibrator/v2/`（v2 Tier + Demerit 系统）

校准触发：`teamagent calibrate` 命令，或 `Stop` Hook 流水线自动调用。

### Tier（知识成熟等级）

Tier 是 v2 校准系统引入的五级成熟度体系，比单一 `confidence` 更稳定（避免噪声波动触发降级）：

| Tier | confidence 阈值 | 含义 |
|------|----------------|------|
| `experimental` | < 0.30 | 刚入库，待观察 |
| `probation` | 0.30~0.55 | 试用期，有初步证据 |
| `stable` | 0.55~0.75 | 稳定有效 |
| `canonical` | 0.75~0.90 | 经充分验证的权威知识 |
| `enforced` | ≥ 0.90 | 强制级，objective 知识才可达此级 |
| `dormant` | - | 因 demerit 累积被休眠，resurrect_count≥3 则永久归档 |

晋升条件：confidence 跨越阈值 **且** 在当前 Tier 驻留够长时间（hysteresis，防止快速抖动）。
降级/休眠：通过 Demerit 系统——每次被 AI 忽略（override）或验证失败会累加 demerit；demerit≥5 软降 1 级，≥15 硬降 2 级，≥30 进入 dormant。Demerit 本身按指数半衰期自然衰减（experimental tier 半衰期 7 天，enforced 28 天）。

实现：`packages/core/src/calibrator/v2/tier.ts`，`packages/core/src/calibrator/v2/demerit.ts`

---

## 3. 系统架构图

### Packages 依赖层次

```
┌──────────────────────────────────────────────────────┐
│                    @teamagent/cli                     │
│   bin.ts — CLI 入口（所有命令）                        │
│   bin-pre-tool-use.ts  ──────────────────────────┐   │
│   bin-post-tool-use.ts ──────── Hook 入口 ────┐  │   │
│   bin-user-prompt-submit.ts                   │  │   │
│   bin-stop.ts                                 ↓  ↓   │
└─────────────────┬──────────────────────────────────-─┘
                  │ imports
                  ↓
┌─────────────────────────────────────────────────────┐
│                  @teamagent/adapters                  │
│   DualLayerStore    SqliteKnowledgeStore             │
│   SqliteEventLog    MarkdownCompiler                 │
│   ClaudeCodeLLMClient  WikiPipeline                  │
│   createPreToolUseHandler  createPostToolUseHandler  │
└─────────────────┬────────────────────────────────────┘
                  │ implements ports, uses core
                  ↓
┌──────────────────────────────────────────────────────┐
│                   @teamagent/core                     │
│   scorer.ts          ← 知识优先级评分（纯函数）         │
│   matcher/           ← 规则匹配（纯函数）               │
│   calibrator/v2/     ← Tier/Demerit/Wilson（纯函数）   │
│   extractor/         ← LLM 提取 prompt 生成            │
│   correction-detector/ ← 纠正时刻识别                  │
│   success-detector/  ← 成功信号识别                    │
│   pipeline/          ← extract/calibrate/compile 流水线│
│   wiki/              ← WikiEntry 过滤/构建              │
│   wiki-injection/    ← Inline Wiki 注入格式化           │
└─────────────────┬────────────────────────────────────┘
                  │ implements
                  ↓
┌─────────────────────────────────────────────────────┐
│                   @teamagent/ports                    │
│   KnowledgeStore  Compiler  Matcher  Calibrator      │
│   CorrectionDetector  SuccessDetector  LLMClient     │
│   AttributionBus  Renderer  WikiSource  WikiEmbedder  │
│   __tests__/*-contract.ts  ← 契约测试套件             │
└─────────────────┬────────────────────────────────────┘
                  │ types only
                  ↓
┌─────────────────────────────────────────────────────┐
│                   @teamagent/types                    │
│   KnowledgeEntry  Scope  Evidence                    │
│   HookProtocol  Attribution  SessionLog  PersistedEvent│
└─────────────────────────────────────────────────────┘
```

### 4 个 Hook 的位置

```
Claude Code 运行时
│
├── UserPromptSubmit ──→ bin-user-prompt-submit.cjs
│   用户按下 Enter 时                 ↓
│                          keyword extract → embed → sqlite-vec
│                          → 注入 Wiki 相关知识到上下文
│
├── PreToolUse ──────→ bin-pre-tool-use.cjs
│   AI 调用工具之前                   ↓
│                          DualLayerStore.findActive()
│                          → matchRulesAsync() → 阻断或注入警告
│
├── PostToolUse ─────→ bin-post-tool-use.cjs
│   工具执行完成后                    ↓
│                          createPostToolUseHandler
│                          → 记录 hook-post.result 事件到 events.db
│
└── Stop ────────────→ bin-stop.cjs
    会话结束时                        ↓
                          analyze → calibrate → compile
                          （自动更新 knowledge.db + CLAUDE.md）
```

### 数据库物理位置

```
~/ (用户 Home 目录)
└── .teamagent/
    ├── global.db          ← scope.level=global 的知识条目
    ├── events.db          ← hook 命中事件、校准事件（append-only）
    └── stop-errors.log    ← Stop Hook 流水线异常日志

{project}/ (Git 仓库根目录)
└── .teamagent/
    └── knowledge.db       ← scope.level=personal 的知识条目
                             + wiki_meta（前沿知识元数据）
                             + rule_candidates（候选规则队列）
                             + knowledge_vec（向量嵌入，sqlite-vec）

.claude/
└── settings.local.json    ← Hook 注册配置（不入 git）
```

---

## 4. 数据流全链路

**场景：用户纠正 AI，系统学习并在下次自动避坑**

```
① 用户使用 Claude Code 开发
   AI 提交一个工具调用（如 Bash: npm install moment）
   ↓
② PreToolUse Hook 触发
   文件: packages/cli/src/bin-pre-tool-use.ts
   - 读 stdin: { tool_name: "Bash", tool_input: { command: "npm install moment" }, ... }
   - 加载 DualLayerStore（project + global 两个 DB）
   - 调用 matchRulesAsync() [packages/core/src/matcher/match.ts]
   - 若命中规则（如"用 dayjs 替代 moment"）→ 返回 permissionDecision="deny"
   - 若未命中 → 返回 {} (允许通过)
   ↓
③ 工具执行（可能被阻断或通过）
   ↓
④ PostToolUse Hook 触发
   文件: packages/cli/src/bin-post-tool-use.ts
   - 读 stdin: { ...PreToolUseInput, tool_response: { ... } }
   - createPostToolUseHandler [packages/adapters/src/hook/claude-agent-sdk/post-tool-use-sdk.ts]
   - 把 hook-post.result 事件写入 ~/.teamagent/events.db
   ↓
⑤ 用户发现问题，手动纠正 AI（或 AI 被 override）
   这是"纠正时刻"——最高价值的学习信号
   ↓
⑥ 会话结束，Stop Hook 触发
   文件: packages/cli/src/bin-stop.ts
   流水线: runStopPipeline()
     Step 1 - analyze [packages/cli/src/commands/analyze.ts]
       - 读会话日志 transcript_path (JSONL)
       - CorrectionDetector [packages/core/src/correction-detector/rule-based.ts]
         检测纠正时刻：显式否定词/多次失败后成功/用户 override 等信号
       - SuccessDetector [packages/core/src/success-detector/rule-based.ts]
         检测成功信号：一次成功/用户表扬/重复使用等
       - 若检测到纠正时刻且 --commit 模式：
         调用 LLM 提取知识 [packages/core/src/extractor/llm-based.ts]
         - 构建 prompt [packages/core/src/extractor/prompt.ts]
         - spawn claude -p (本机 Claude Code) 提取结构化 KnowledgeEntry
         - 写入 {project}/.teamagent/knowledge.db
     Step 2 - calibrate [packages/cli/src/commands/calibrate.ts]
       - 读 events.db 中的历史 hook 命中记录
       - 调用 CalibratorV2 [packages/core/src/calibrator/v2/index.ts]
         - 用 Wilson Score 算法重算 confidence
         - 更新 Tier（hysteresis 防抖）
         - 累积 Demerit（被忽略则扣分，指数衰减）
       - 写回 knowledge.db
     Step 3 - compile [packages/cli/src/commands/compile.ts]
       - 读所有 active 知识条目
       - scoreEntry() [packages/core/src/scorer.ts] 对所有条目打分
         score = confidence×0.4 + hit_count归一化×0.3 + recency×0.2 + enforcement_weight×0.1
       - 选 Top 15 写入 CLAUDE.md 的 TEAMAGENT:START/END 区块
       - 同时生成 Agent Skill 文件（stable+ 级别的知识）
   ↓
⑦ 下次会话开始
   Claude Code 读取 CLAUDE.md → AI 从第一句话起就带着更新后的经验
   用户再提 moment 相关问题 → PreToolUse Hook 命中规则 → 阻断
   "同一个人不需要纠正第二次"
```

---

## 5. 目录结构解析

```
packages/
├── types/                    ← 共享类型层，无任何 IO
│   └── src/
│       ├── knowledge-entry.ts  ⭐ KnowledgeEntry + computeEnforcement 核心类型
│       ├── hook-protocol.ts    ⭐ PreToolUseInput / PostToolUseInput / HookOutput
│       ├── attribution.ts      AttributionEvent / VisibilityMode
│       ├── session-log.ts      解析 ~/.claude/ 会话日志的类型
│       └── persisted-event.ts  events.db 存储的事件 kind 联合类型
│
├── ports/                    ← 接口层（Port 契约），无实现
│   └── src/
│       ├── knowledge-store.ts  KnowledgeStore Port 接口
│       ├── attribution-bus.ts  AttributionBus Port 接口
│       ├── calibrator-v2.ts    CalibratorV2 Port 接口
│       ├── wiki-retriever.ts   WikiRetriever Port 接口
│       └── __tests__/*-contract.ts  ⭐ 所有 Port 的契约测试套件
│
├── core/                     ← 业务逻辑层（禁止 IO）
│   └── src/
│       ├── scorer.ts           ⭐ 知识优先级评分公式（纯函数）
│       ├── matcher/
│       │   ├── match.ts        ⭐ 规则匹配主逻辑（含 AST 上下文增强）
│       │   └── keyword-matcher.ts  关键词粗筛
│       ├── calibrator/v2/
│       │   ├── tier.ts         ⭐ Tier 晋升/降级逻辑
│       │   ├── demerit.ts      ⭐ Demerit 计算（驾照扣分制）
│       │   ├── wilson.ts       Wilson Score 置信区间算法
│       │   └── hysteresis.ts   Tier 变更防抖（迟滞）
│       ├── correction-detector/
│       │   └── rule-based.ts   ⭐ 纠正时刻识别（多信号融合）
│       ├── success-detector/
│       │   └── rule-based.ts   成功信号识别
│       ├── extractor/
│       │   ├── llm-based.ts    ⭐ LLM 知识提取器（调用 Claude Code）
│       │   └── prompt.ts       提取 prompt 模板
│       ├── importer/
│       │   ├── claude-md-parser.ts  解析已有 CLAUDE.md → 知识条目
│       │   └── cursor-rules-parser.ts  解析 .cursorrules
│       ├── pipeline/
│       │   ├── extract-pipeline.ts    ⭐ analyze 命令流水线
│       │   ├── calibration-pipeline-v2.ts  ⭐ calibrate 命令流水线
│       │   └── compile-pipeline.ts    ⭐ compile 命令流水线
│       ├── wiki/               Wiki 来源过滤 / 条目构建
│       ├── wiki-injection/     ⭐ UserPromptSubmit 注入格式化逻辑
│       └── compiler/
│           ├── markdown.ts     CLAUDE.md 编译器（纯函数）
│           └── agent-skill.ts  Agent Skill 编译器（纯函数）
│
├── adapters/                 ← 实现层（含 IO，实现 ports 接口）
│   └── src/
│       ├── storage/sqlite/
│       │   ├── schema.ts       ⭐ SQLite DDL + migration（openDb 幂等）
│       │   ├── dual-layer-store.ts  ⭐ 双层存储路由
│       │   ├── sqlite-knowledge-store.ts  单 DB 的知识 CRUD
│       │   ├── sqlite-event-log.ts  events.db 写入/读取
│       │   ├── sqlite-wiki-retriever.ts  ⭐ sqlite-vec 向量检索
│       │   └── wiki-store.ts   wiki_meta 表 CRUD
│       ├── hook/claude-agent-sdk/
│       │   ├── pre-tool-use-sdk.ts   ⭐ PreToolUse handler 工厂
│       │   └── post-tool-use-sdk.ts  ⭐ PostToolUse handler 工厂
│       ├── compiler/
│       │   └── markdown-compiler.ts  把 markdown.ts 纯函数 + 文件写入组合
│       ├── llm/
│       │   └── claude-code-client.ts  ⭐ spawn claude -p 的 LLM 客户端
│       ├── wiki/
│       │   ├── xenova-embedder.ts     ⭐ @xenova/transformers 384 维嵌入
│       │   ├── haiku-judge.ts         用 claude-haiku 判断 wiki 条目价值
│       │   └── wiki-pipeline.ts       ⭐ wiki:pull 完整流水线
│       └── attribution/
│           ├── in-memory-bus.ts    测试用 AttributionBus
│           └── stdout-renderer.ts  终端输出 Renderer
│
└── cli/                      ← 入口层
    └── src/
        ├── bin.ts              ⭐ CLI 总入口（所有命令路由）
        ├── bin-pre-tool-use.ts  ⭐ PreToolUse Hook 入口
        ├── bin-post-tool-use.ts ⭐ PostToolUse Hook 入口
        ├── bin-user-prompt-submit.ts  ⭐ UserPromptSubmit Hook 入口
        ├── bin-stop.ts          ⭐ Stop Hook 入口（analyze+calibrate+compile 流水线）
        ├── commands/
        │   ├── install-hook.ts  ⭐ Hook 注册逻辑（写 settings.local.json）
        │   ├── analyze.ts       analyze 命令实现
        │   ├── calibrate.ts     calibrate 命令实现
        │   ├── compile.ts       compile 命令实现
        │   ├── pitfall.ts       pitfall 命令实现（手动录入踩坑）
        │   ├── stats.ts         stats 命令实现
        │   ├── wiki.ts          wiki:* 命令路由
        │   └── ingest.ts        ingest 命令实现（多源摄入）
        ├── tsup.config.ts       CLI 主包打包配置
        └── tsup.hook.config.ts  ⭐ Hook 专用打包配置（自包含 .cjs）
```

---

## 6. 开发者快速上手

### 环境要求

- **Node.js 22+**（schema.ts 使用 `node:sqlite` 内置模块，Node 22 才有）
- **pnpm 9+**
- Windows 11 / macOS / Linux（Windows 已经过验证，路径处理有特殊 workaround）

### 首次运行步骤

```bash
# 1. 克隆仓库
git clone <repo-url> && cd teamagent

# 2. 安装依赖
pnpm install

# 3. 构建 Hook bundle（必须先构建才能注册 Hook）
pnpm --filter @teamagent/cli build:hook

# 4. 跑测试（Windows 注意：vitest 强制 fileParallelism: false，顺序执行）
pnpm test

# 5. 类型检查
pnpm typecheck

# 6. 在当前项目注册 Hook（写入 .claude/settings.local.json）
pnpm teamagent install-hook

# 7. 验证 Walking Skeleton
pnpm teamagent skeleton-demo
```

### 常用命令速查表

```bash
# ===== 知识管理 =====
pnpm teamagent pitfall                     # 交互式手动录入一条踩坑经验
pnpm teamagent pitfall --non-interactive \
  --trigger="场景描述" \
  --wrong="错误做法" \
  --correct="正确做法" \
  --reason="原因"                          # 非交互模式录入
pnpm teamagent stats                       # 查看知识库统计摘要
pnpm teamagent stats --stuck-in-promotion  # 列出卡在 probation 超 N 天的规则
pnpm teamagent review [N]                  # 列出最近 N 条知识供人工复核

# ===== 会话分析 =====
pnpm teamagent analyze                     # 分析最近一次 Claude Code 会话
pnpm teamagent analyze --commit            # 分析 + 调用 LLM 提取知识写入 DB
pnpm teamagent analyze --session=<path>    # 分析指定会话文件
pnpm teamagent scan-errors                 # 扫描会话日志中的错误信号→生成候选规则
pnpm teamagent review-candidates           # 交互式审核候选规则（[a]批准/[r]拒绝）

# ===== 知识进化 =====
pnpm teamagent calibrate                   # 重算置信度 + 自动归档低分条目
pnpm teamagent calibrate --dry-run         # 只预览，不写入
pnpm teamagent compile                     # 编译 CLAUDE.md + Agent Skills
pnpm teamagent compile --dry-run           # 预览将写/删哪些文件

# ===== 安装/卸载 =====
pnpm teamagent init                        # 一键安装：建目录+导入规则+注册 Hook+编译 CLAUDE.md
pnpm teamagent install-hook                # 单独注册 4 个 Hook 到 settings.local.json
pnpm teamagent uninstall-hook              # 移除 Hook 注册
pnpm teamagent disable                     # 临时禁用 Hook（保留数据）
pnpm teamagent enable                      # 重新启用 Hook
pnpm teamagent uninstall [--delete-data]   # 完全卸载

# ===== Wiki（前沿知识）=====
pnpm teamagent wiki:pull                   # 从 5 个源拉取前沿知识
pnpm teamagent wiki:add <url>              # 手动添加单条 URL
pnpm teamagent wiki:list                   # 查看已入库的 wiki 条目
pnpm teamagent wiki:stats                  # wiki 统计
pnpm teamagent wiki:subscriptions          # 查看订阅源
pnpm teamagent wiki:subscribe --repo owner/repo  # 订阅 GitHub 仓库 Releases
pnpm teamagent wiki:dislike <id>           # 标记不喜欢（注入时跳过）

# ===== 多源摄入 =====
pnpm teamagent ingest --from-audit         # 从 npm audit 摄入安全知识
pnpm teamagent ingest --from-git --since=30d  # 从 git hotspot 摄入知识
pnpm teamagent ingest --from-ci --since=30d   # 从 CI 失败记录摄入知识

# ===== 配置 =====
pnpm teamagent config show                 # 查看当前配置
pnpm teamagent config stop-mode async      # Stop Hook 切换为异步模式（不阻塞关闭）

# ===== 调试 =====
pnpm teamagent demo hook Bash 'command=npm install moment'  # 离线模拟 PreToolUse
pnpm teamagent verify                      # 跑 5 个端到端验证场景
pnpm teamagent dogfood-report              # 生成自举报告（系统自我评估）
```

**环境变量：**
```bash
TEAMAGENT_VISIBILITY=silent|smart|verbose  # 控制归因渲染详细程度（默认 smart）
```

### 如何添加新的 CLI 命令

1. 在 `packages/cli/src/commands/` 下新建文件，如 `my-command.ts`，导出 `executeMyCommand()` 函数
2. 在 `packages/cli/src/bin.ts` 的 `switch(command)` 中添加 `case "my-command":` 分支
3. 在 `bin.ts` 的 help 文本里追加用法说明

### 如何添加新的知识采集信号

在 `packages/core/src/correction-detector/rule-based.ts` 中，`CorrectionDetectorRuleBased` 通过分析 `SessionTurn[]` 序列识别纠正时刻。添加新信号需要：

1. 在 `rule-based.ts` 的检测逻辑里添加新的信号模式（如检测特定工具调用序列）
2. 对应补充信号权重（现有信号范围 0.30~0.95）
3. 在 `packages/core/src/correction-detector/__tests__/` 下添加测试用例（TDD 原则：先写测试再改实现）

---

## 7. Hook 系统详解

### Claude Code 如何触发 Hook

Claude Code 在触发 Hook 时，向注册的命令的 **stdin** 发送 JSON，等待该进程返回 stdout JSON 后继续。格式：

**PreToolUse stdin 示例：**
```json
{
  "session_id": "abc123",
  "hook_event_name": "PreToolUse",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "transcript_path": "/path/to/transcript.jsonl",
  "tool_name": "Bash",
  "tool_input": { "command": "npm install moment" },
  "tool_use_id": "toolu_xyz"
}
```

**Hook stdout 返回格式（HookOutput）：**
```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "teamagent: 规则匹配 [warn] 使用 dayjs 替代 moment"
  }
}
```

类型定义：`packages/types/src/hook-protocol.ts`

### 4 个 Hook 的职责详解

**PreToolUse** (`bin-pre-tool-use.cjs`)
- 匹配工具：`Bash|Write|Edit|WebFetch`
- 输入：`PreToolUseInput`
- 处理：加载知识库 → `matchRulesAsync()` → 若 enforcement=block 则 deny，若 warn 则注入警告
- 输出：`HookOutput`（deny 或带 additionalContext 的 allow）
- 超时：30 秒

**PostToolUse** (`bin-post-tool-use.cjs`)
- 匹配工具：`Bash|Write|Edit|WebFetch`
- 输入：`PostToolUseInput`（含 `tool_response`）
- 处理：将执行结果写入 `events.db` 作为 `hook-post.result` 事件
- 输出：空 `HookOutput`（不影响工作流）
- 超时：30 秒

**UserPromptSubmit** (`bin-user-prompt-submit.cjs`)
- 无 matcher（所有 prompt 触发）
- 输入：`{ prompt: string }`
- 处理：提取关键词 → XenovaEmbedder 生成 384 维向量 → sqlite-vec 相似度查询 → 返回相关 Wiki 条目的 tldr
- 输出：注入文本（写到 stdout，Claude Code 将其加入上下文）
- 超时：10 秒（有 5 秒内部超时保底）
- 冷却控制：同一条目 30 分钟内不重复注入，同一会话最多注入 15 次

**Stop** (`bin-stop.cjs`)
- 无 matcher
- 输入：`{ session_id, transcript_path, cwd, hook_event_name }`
- 处理：analyze → calibrate → compile 三阶段流水线（sync 模式等待完成，async 模式 detach 子进程立即返回）
- 超时：60 秒（流水线内部有 55 秒上限）
- 错误：写入 `~/.teamagent/stop-errors.log`，永远 exit 0

### Hook 错误处理原则

**所有 Hook 入口的顶层 catch 都必须 exit 0**，永不 exit 1 或 exit 2。原因：Hook 报错会阻断 Claude Code 的正常工作流，这是不可接受的。系统选择"宁可不拦截，也不能卡住用户"。错误写到 stderr（对用户可见但不阻断）或日志文件。

### 如何重新注册 Hook

```bash
pnpm teamagent install-hook
```

此命令写入 `{project}/.claude/settings.local.json`，幂等，重复执行无副作用。注册的命令格式为：
```
node C:/bzli/teamagent/packages/cli/dist/bin-pre-tool-use.cjs
```

（Windows 下路径用正斜杠，避免 bash 吞掉反斜杠）

如果修改了 Hook 代码，需要重新 build：
```bash
pnpm --filter @teamagent/cli build:hook
```

### tsup.hook.config.ts 为何独立

Hook bundle 与主 CLI bundle 使用不同配置，原因是 Hook 有特殊约束：

1. **必须是自包含单文件**：Hook 被 Claude Code 在 `%TEMP%` 目录 spawn，不在项目根，无法用 `npx tsx` 因为找不到 workspace 依赖
2. **格式必须是 CJS**：Node.js `--input-type` 在 spawn 场景下默认 CJS
3. **所有 workspace 依赖打包进去**：`noExternal: ["@teamagent/types", "@teamagent/ports", "@teamagent/core", "@teamagent/adapters", "zod"]`
4. **排除 native addon**：`external: ["sharp", "onnxruntime-node", "jsdom"]`——这些有 `.node` 二进制扩展，无法打包

文件：`packages/cli/tsup.hook.config.ts`

---

## 8. 知识库设计

### 数据库 Schema 简述

`knowledge.db`（和 `global.db`）包含以下主要表：

**`knowledge` 表（核心）**

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | 唯一标识 |
| scope_level | TEXT | personal/team/global |
| category | TEXT | C/E/S/K |
| current_tier | TEXT | experimental/.../enforced/dormant |
| confidence | REAL | 0.0~1.0 |
| demerit | REAL | 累计扣分（指数衰减） |
| enforcement | TEXT | block/warn/suggest/passive |
| status | TEXT | active/conflict/stale/archived/dormant |
| hit_count | INTEGER | 被命中次数 |
| override_count | INTEGER | 被绕过次数 |

**`wiki_meta` 表（Wiki 专用）**

关联 `knowledge.id`，额外存储 `source_url`、`source_type`、`tldr`、`keywords`、`user_thumbs_down`、`inline_injection_count` 等 Wiki 专属字段。

**`events` 表（事件日志，append-only）**

存储所有 hook 命中事件（kind 如 `hook-pre.matched`、`hook-post.result`），供 Calibrator 读取用于置信度更新。

**`observations` 表**

Calibrator V2 用，存储 `(knowledge_id, outcome=success|failure)` 细粒度观察记录，供 Wilson Score 算法计算置信区间。

**`rule_candidates` 表**

`scan-errors` 命令生成的候选规则，status=pending，等待 `review-candidates` 命令人工审核。

完整 DDL：`packages/adapters/src/storage/sqlite/schema.ts:19`

### personal vs global scope 的路由逻辑

`DualLayerStore.add(entry)` 根据 `entry.scope.level` 路由：
- `personal` → `project.add(entry)` → `{project}/.teamagent/knowledge.db`
- `global` → `global.add(entry)` → `~/.teamagent/global.db`
- `team` → 当前抛错（Phase 4 才支持）

查询时 `findActive()` 合并两层结果，`personal` 优先级高于 `global`（匹配时 personal 先返回）。

### confidence 计算

v2 系统使用 **Wilson Score 置信区间**（`packages/core/src/calibrator/v2/wilson.ts`）替代简单增减：

```
wilson_lower = (successes + z²/2) / (total + z²) - z × √(successes×failures/total + z²/4) / (total + z²)
```

其中 z=1.645（90% 置信区间），successes/failures 来自 `observations` 表。这比直接 ±0.05 更稳健——小样本时下界更保守，大样本时更接近真实成功率。

### Tier 晋升/降级条件

**晋升**（confidence 驱动 + hysteresis 防抖）：
- confidence 超过阈值（experimental<0.30 → probation<0.55 → stable<0.75 → canonical<0.90）
- 在当前 Tier 驻留时间满足 `hysteresis` 要求（防止噪声导致的快速抖动）
- 实现：`packages/core/src/calibrator/v2/hysteresis.ts`

**降级**（Demerit 系统）：
- 每次 AI override（绕过规则）或 validator 验证失败，累加 demerit
- demerit≥5：强制 Tier 降 1 级（soft demote）
- demerit≥15：强制 Tier 降 2 级（hard demote）
- demerit≥30：进入 dormant（休眠）
- demerit 按指数半衰期自然衰减（experimental: 7天，enforced: 28天）
- dormant 状态可被 resurrect，`resurrect_count≥3` 则永久归档，防止"僵尸知识"反复复活

---

## 9. 当前已知限制和 TODO

### LLM 提取超时问题

`teamagent analyze --commit` 会 spawn 本机 `claude -p` 进行知识提取，在 Claude Code 会话**内部**调用时存在嵌套超时问题：外层 Stop Hook 有 55 秒总超时，而 LLM 提取本身可能需要 10~30 秒，在复杂会话日志下容易超时导致提取不完整。

**当前缓解方案**：`config stop-mode async` 切换为异步模式（Stop Hook 立即返回，后台继续执行），但异步模式下用户看不到分析完成的提示。

**根本解决**（设计中）：SP-2 Benchmark 将建立完整的端到端测量基础，为后续优化提供依据。

### MCP Server 未实现

设计文档（`docs/specs/2026-04-13-teamagent-design.md`，第四章）中，MCP Server 是"实时顾问"（帮助方式 ②）的核心实现，提供 `check_pitfall`/`get_best_practice`/`report_correction`/`get_stats` 4 个工具。

当前 Phase 1 的 PreToolUse Hook 提供了有限的本地规则匹配（相当于简化版 `check_pitfall`），但 AI 无法在**思考过程中**主动查询知识库。MCP Server 计划在 Phase 2 上线。

### Team Scope 未实现

`DualLayerStore` 中 `scope.level=team` 会直接 throw error。团队知识共享（git tracked 的 `.teamagent/` 目录，审核门，冲突仲裁）计划在 Phase 3 实现。

### Session Monitor 未实现

设计文档第五章描述了 Session Monitor 旁路进程，用于检测 AI 连续失败、打转、作用域突变等行为模式并注入警告。当前 Phase 1 未实现，计划 Phase 2 上线。

### 其他已知问题

- **Windows 下 vitest 并发 OOM**：`vitest.config.ts` 强制 `fileParallelism: false`，测试顺序运行。不要开并发。
- **sqlite-vec 可选依赖**：若 `sqlite-vec` native binding 不可用，向量检索功能静默降级（wiki 注入功能不可用），不报错。
- **`knowledge_vec` 虚表创建时机**：必须在 `sqlite-vec` extension 加载后，schema.ts `openDb()` 里处理，而非在 `INIT_SQL` 静态 DDL 里（详见 schema.ts 注释）。

---

## 10. Bug 修复历史（防止重踩）

以下是近期修复的重要 Bug，记录于此防止重踩：

### Hook 路径反斜杠问题（Windows）
**问题**：`install-hook.ts` 写入的 hook command 路径用了 Windows 反斜杠（`C:\bzli\...`），在 Git Bash 环境下会被 bash 吞掉反斜杠，导致 Hook 无法启动。
**修复**：`toForwardSlash()` 函数把所有反斜杠转为正斜杠再写入 settings.local.json。
**文件**：`packages/cli/src/commands/install-hook.ts:63`

### Hook bundle 引用 jsdom 报错
**问题**：`bin-pre-tool-use.cjs` 打包时 tsup 尝试 bundle jsdom，但 jsdom 在 bundle 后找不到 `default-stylesheet.css`（模块加载时读取文件路径被破坏）。
**修复**：将 `jsdom` 加入 `external`，不打包进 bundle。
**文件**：`packages/cli/tsup.hook.config.ts:37`

### UserPromptSubmit hook 未声明 kind 导致 TS 编译失败
**问题**：向 `events.db` emit 新事件时，没有先在 `packages/types/src/persisted-event.ts` 的 `kind` 联合类型中添加新 kind 值，导致 TypeScript 编译报错。
**教训**：新事件 kind 必须先加类型，再 emit。`DEMERIT_KIND_TO_SOURCE` 等映射表也需同步更新。
**文件**：`packages/types/src/persisted-event.ts`

### Stop Hook session_id 缺失导致 analyze 跳过
**问题**：早期 Stop Hook 实现尝试用 `session_id` 精确匹配会话文件，但 hook input 不保证有 `session_id`，导致 analyze 总是 no-op。
**修复**：改用 `transcript_path` 直接定位会话文件，或用 5 分钟时间窗 + `tool_name` 匹配，接受 false positive 而不依赖 session_id。
**文件**：`packages/cli/src/bin-stop.ts`

---

*本文档基于代码截面生成，如代码变更请同步更新。*
