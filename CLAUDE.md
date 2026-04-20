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

---

*以上为人工维护的开发约定。从 M1 开始，CLAUDE.md 会多一个 TEAMAGENT:START/END 区块，由系统自动维护"已学到的经验"。*

<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验（64条活跃知识）
- hook 代码写完后必须在 .claude/settings.local.json 注册对应 hook 事件，并端到端验证触发链路——Claude Code hook 由 harness 按 settings.local.json 配置调度，仅有脚本文件不会自动生效；未注册 = 代码形同虚设。自动化能力（如自学习 pipeline）还需 Stop/UserPromptSubmit 等触发事件，手动命令只是 fallback，不能当作闭环 [0.90]
- 使用 跑完实际验证命令（构建+启动+测试）并贴出真实输出再宣布完成 而非 全部修复完成——用户反复看到 AI 宣称修复完还残留 bug，说明 AI 基于局部证据（如单测绿）就下结论；完成声明必须以端到端验证输出为证据，否则等于骗用户 [0.90]
- 使用 先读用户指向的文件，重新 brainstorm + 补全需求，再拆 task 实现；API key 来源询问用户（如 claude code haiku） 而非 计划文档只是设计文档，还没实现——AI 未读文件就断言不存在会误导用户；正确做法是先 Read 指定路径、以文件内容为准，再结合用户偏好（如用 haiku 作 token 来源）规划实现 [0.90]
- 使用 忽略 <local-command-caveat> 包裹的消息，除非用户明确要求分析 而非 <local-command-caveat>——该标签内容由本地命令自动生成，非用户意图表达；AI 主动响应会污染对话上下文，误把系统噪声当用户指令 [0.90]
- 使用 忽略 <local-command-caveat> 包裹的消息，除非用户明确要求分析 而非 <local-command-caveat>——该标签内容由本地命令自动生成，非用户意图表达；AI 主动响应会污染对话上下文，误把系统噪声当用户指令 [0.90]
- 使用 忽略该标签内所有内容，除非用户明确要求分析 而非 <local-command-caveat>——<local-command-caveat> 内容由本地命令自动生成，非用户意图；响应它会把系统噪声当用户指令，污染对话上下文 [0.90]
- 使用 忽略该标签内所有内容，除非用户明确要求分析 而非 <local-command-caveat>——<local-command-caveat> 内容由本地命令自动生成，非用户意图；响应它会把系统噪声当用户指令，污染对话上下文 [0.90]
- 使用 忽略该标签内所有内容，除非用户明确要求分析 而非 <local-command-caveat>——<local-command-caveat> 内容由本地命令自动生成，非用户意图；响应它会把系统噪声当用户指令，污染对话上下文 [0.90]
- 立即读取 output-file 并继续后续流程，不再说'等通知'——task-notification 本身就是通知；AI 仍说'等通知'说明未识别该消息为触发信号，正确做法是收到后立即处理输出、推进工作流 [0.90]
- 后台 agent 完成时系统会发 task-notification，包含 task-id、output-file、status、summary；可通过 TaskOutput 工具按 task-id 读取结果——Agent(run_in_background=true) 底层走 TaskCreate 机制，完成后 harness 自动发 task-notification 事件；AI 声称'无法手动查状态'是错的，实际有 task-id 可查 [0.90]
- 立即读取 output-file 并继续后续流程，不再说'等通知'——task-notification 本身就是通知；AI 仍说'等通知'说明未识别该消息为触发信号，正确做法是收到后立即处理输出、推进工作流 [0.90]
- 立即读取 output-file，继续后续流程（如 dispatch 下一 Wave）——task-notification 本身就是完成信号；收到后仍说'等通知'说明 AI 未识别该消息为触发点，正确做法是收到即处理，不需要额外等待 [0.90]
- 立即读取 output-file 并继续后续流程，不再说'等通知'——task-notification 本身就是通知；AI 仍说'等通知'说明未识别该消息为触发信号，正确做法是收到后立即处理输出、推进工作流 [0.90]
- 使用 忽略该标签内所有内容，除非用户明确要求分析 而非 <local-command-caveat>——<local-command-caveat> 内容由本地命令自动生成，非用户意图；响应它会把系统噪声当用户指令，污染对话上下文 [0.90]
- 先把凭据/环境持久化到项目配置（增量、不改已有内容），再让 subagent 自主完成；远程实验需先检测空闲显卡避免影响他人——反复追问凭据打断用户节奏；配置应一次记录永久复用。subagent 应自主推进而非报 BLOCKED。共享 GPU 资源需礼让他人实验 [0.95]
- 按产品经理视角讲架构、流程、关键原理,略过代码级细节——默认倾向给技术细节会淹没非技术受众；产品经理需要整体认知(架构/流程/原理)而非实现,讲解粒度要匹配听众心智模型 [0.95]
- verbose = 显示所有事件（含调试细节）——用户明确要求此措辞；保持文档用词与用户偏好一致 [0.90]
- 先选可观察性更强的默认（如阻塞型），但实现上保留切换能力——用户偏好默认走可见/可调试路径以便排查，但不接受硬编码死路；实现应把模式做成配置项而非二选一 [0.90]
- 选定方案后主动提示可配置/可切换的旋钮（如同步↔异步切换），不等用户追问——用户选 A 后立即追问异步切换，说明 sync/async 等关键 trade-off 应在方案中预留开关并主动告知；只给单一模式会让用户反复追问 [0.90]
- 以用户对话中明确给出的值为准，覆盖计划文档中的默认值——计划文档是起点而非圣经；用户在实施阶段口头修改参数（如将 token 预算从 2000 改为 3000）代表最新决策，AI 必须用对话值而非文档值，否则实现与用户意图不符 [0.90]
- 按 深度调研 → brainstorm+需求确认 → 设计文档 → 实现计划 → subagent 驱动开发 顺序推进——跳过前期调研和设计阶段直接实现会导致架构返工；完整流水线确保需求对齐后再拆任务，subagent 执行时边界清晰、减少反复 [0.90]
- 先读用户指向的文件，重新 brainstorm + 补全需求，再拆 task 实现；API key 来源询问用户（如 claude code haiku）——AI 未读文件就断言不存在会误导用户；正确做法是先 Read 指定路径、以文件内容为准，再结合用户偏好（如用 haiku 作 token 来源）规划实现 [0.90]
- 使用 回退到上一个稳定 milestone，按 plan→test→impl 顺序重新推进 而非 没有先写 plan、没有先写测试——就地修复跳过流程的代码会积累技术债并违反项目约定；用户偏好硬回退而非打补丁，保持 milestone 边界干净 [0.90]
- 主 agent 调用 subagent 执行远程实验，自己保留上下文处理后续任务——长耗时远程实验若占用主 agent 会阻塞后续工作；委派给 subagent 可并行推进，主 agent 保持响应 [0.80]
- 使用 忽略 <local-command-caveat> 包裹的全部内容，除非用户明确要求分析 而非 <local-command-caveat>——<local-command-caveat> 由本地 hook（如 Caveman）自动注入，不代表用户意图；把它当用户纠正会产生噪音，污染对话上下文 [0.80]
- 找一个 baseline 会踩坑（多消耗 token/时间重试）而 teamagent 因提前避坑直接成功的任务——teamagent 应比 baseline 更省时省 token——hook deny+retry 路径天然增加开销；真正体现 pitfall-guard 价值的任务应是：baseline 踩坑导致多轮重试浪费，teamagent 一次通过反而更快更省——overhead 为负才能说明系统有净收益 [0.80]
<!-- TEAMAGENT:END -->
