# TeamAgent 开发约定

本文件给 Claude Code 读——在此项目内工作时必须遵守以下约定。

**参考文档**：
- 设计文档：`docs/specs/2026-04-13-teamagent-design.md` (v5.2)
- 实现计划：`docs/specs/2026-04-14-teamagent-phase1-plan.md` (v1.2)

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

---

*以上为人工维护的开发约定。从 M1 开始，CLAUDE.md 会多一个 TEAMAGENT:START/END 区块，由系统自动维护"已学到的经验"。*
