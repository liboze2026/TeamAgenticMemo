# TeamAgent 开发约定

本文件给 Claude Code 读——在此项目内工作时必须遵守以下约定。

**参考文档**：
- 设计文档：`docs/specs/2026-04-13-teamagent-design.md` (v5.2)
- Phase 2+ 产品 roadmap：`docs/superpowers/specs/2026-04-15-product-roadmap.md`
- Phase 2 设计：`docs/superpowers/specs/2026-04-15-phase2-design.md`
- Phase 1 实现计划（已归档）：`docs/backup/phase1/specs/2026-04-14-teamagent-phase1-plan.md`

---

## 元约束（M0 起生效，所有 Milestone 适用）

- **新增 Port 必须先写契约测试再写实现**。契约测试套件放 `packages/ports/src/__tests__/*-contract.ts`，通过 `@teamagent/ports/contracts` subpath 暴露。任何 Port 的新实现必须复用对应契约套件。
- **Functional Core, Imperative Shell**。`packages/core/` 下禁止 import `fs` / `node:fs` / `node:child_process` / 任何 IO 模块。核心逻辑必须是纯函数，时间等副作用源通过参数注入（例如 `scoreEntry(entry, maxHitCount, now)` 里的 `now`）。
- **归因必须走 AttributionBus**。组件不得直接 `console.log` 用户可见信息。所有"系统帮你做了什么"通过 `bus.emit(event)` 发结构化事件，由 Renderer 渲染。违反此约定的 PR 不接受。
- **Walking Skeleton 不断裂**。每个 Milestone 结束时 `pnpm teamagent skeleton-demo`（或 Milestone 对应命令）必须跑通。不允许"半成品 + 计划下个 commit 修好"——Milestone 内部的 commit 可以有失败测试，但 Milestone 结束的那个 commit 必须全绿。
- **Port 接口冻结于 M0**。如果 Milestone 实施中发现 Port 设计有误，先改 Port + 更新契约测试 + 同步更新 plan 文档，再改实现。不得偷偷改 Port 骗过测试。

## 开发节奏

- **TDD**：每个新功能先写测试（看到红）→ 写最小实现（变绿）→ commit。
- **小 commit**：每个 commit 覆盖一个 "概念上完整的小事"。跑得通、测试绿。
- **commit message 格式**：`feat(m{N}): <...>` / `fix(m{N}): <...>` / `refactor(m{N}): <...>`，让 Milestone 产出在 git 历史中可溯。

## 跑命令

```bash
pnpm install          # 首次 / 依赖变动后
pnpm test             # 跑所有测试
pnpm typecheck        # 跑所有包的 tsc --noEmit
pnpm teamagent <cmd>  # 跑 CLI（M0 可用：skeleton-demo）
```

## 已知限制 / workaround

- **Windows 下 vitest 并发 OOM**：`vitest.config.ts` 强制 `fileParallelism: false`，测试顺序跑。不要打开并发。
- **CLI E2E subprocess 测试**：M0 暂未启用（相同 OOM 原因）。手动运行 `pnpm teamagent skeleton-demo` 做视觉验证。M1 引入真实 IO 后再考虑方案。

## M4-B 语义匹配（自 0.9.4 起）

- Matcher 已从 substring 升级为 BM25+dense RRF + soft-AND 打分
- 所有规则（含 practice 类）都参与运行时匹配，通道字段已废弃
- 若新版表现异常，回滚：env `TEAMAGENT_MATCHER=legacy`
- 规则迁移：`pnpm teamagent migrate-v6` 给旧规则生成语义描述 + embedding

---

*以上为人工维护的开发约定。从 M1 开始，CLAUDE.md 会多一个 TEAMAGENT:START/END 区块，由系统自动维护"已学到的经验"。*

<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验（25条活跃知识）
- 使用 忽略该标签内容，除非用户明确要求分析该消息 而非 <local-command-caveat>——该标签由本地命令自动生成，代表系统噪声而非用户意图，主动响应会污染对话上下文、误把噪声当作用户指令 [0.90]
- 使用 识别并忽略该标签内的消息，不当作用户指令进行响应 而非 <local-command-caveat>——该标签标记的是系统自动生成的消息，不代表用户真实意图；响应会将系统噪声误认为用户指令，污染对话逻辑 [0.90]
- 忽略该标签包裹的内容，除非用户明确要求分析——该标签标记的是本地命令自动生成而非用户意图的消息；响应会把系统噪声当指令污染对话 [0.90]
- 识别并忽略该标签内的消息，除非用户明确要求分析——该标签表示消息由系统自动生成而非用户真实意图，主动响应会将系统噪声误认为用户指令，污染对话逻辑和上下文 [0.90]
- 使用 忽略被 <local-command-caveat> 标记的内容，仅当用户明确要求时才分析 而非 <local-command-caveat>——该标签标记的是系统自动生成的噪声而非用户指令；对其响应会误把系统输出当作用户意图，污染对话逻辑 [0.90]
- 使用 跑完实际验证命令（构建+启动+测试）并贴出真实输出再宣布完成 而非 全部修复完成——用户反复看到 AI 宣称修复完还残留 bug，说明 AI 基于局部证据（如单测绿）就下结论；完成声明必须以端到端验证输出为证据，否则等于骗用户 [0.90] [预置]
- 先充分理解用户的核心需求、态度和约束（包括决心程度、核心原则如'全自动化'），再基于此设计方案，而不应以 AI 自主假设的难度/成本约束来预先限制方案范围——用户表明有激进改动的意愿和明确的核心原则（全自动化、破釜沉舟），AI 却基于自主假设的'低成本'优先级提出保守方案，脱离了用户真实意图；应先充分沟通理解，再设计 [0.95]
- 用 embedding/语义向量思想快速定位核心洞察，而非长篇场景比喻和逐条对比分析——详细的场景讲解虽然全面但效率低；embedding 思想强调在高维语义空间中快速匹配用户的真实诉求，能更直接地聚焦问题本质 [0.90]
- 使用 process.chdir then path.resolve, or C:/bzli/... format 而非 DatabaseSync('/c/bzli/...')——node:sqlite uses Win32 API, does not recognize Git Bash /c/ mountpoint [0.70]
- 使用 use pnpm teamagent <cmd>, or build first then node dist/bin-stop.cjs 而非 node --input-type=module importing packages that re-export .ts source files——adapters/dist/index.js re-exports from .ts source, fails without tsx. Only the bundled bin-stop.cjs / bin.js are runnable standalone [0.70]
<!-- TEAMAGENT:END -->
