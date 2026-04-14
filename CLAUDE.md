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

<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验（15条活跃知识）
- 使用 通过目标包 package.json 的 exports 字段暴露 subpath（例如 "./contracts"）再 import 而非 import ... from "@teamagent/ports/src/__tests__/xxx.js"——workspace 包的 exports 字段是 API 边界，pnpm/vite 不会解析未暴露的深路径；深路径 import 会在安装后构建阶段失败 [0.70]
- 使用 passive 在打分公式里仍有 0.1 权重，所以 passive 条目 score 最低为 0.01（0.1 × 0.1） 而非 期望 passive 条目 score=0——spec v5.2 评分公式: confidence×0.4 + hit×0.3 + recency×0.2 + enforcement×0.1；passive 不是 0 分，只是最小分 [0.70]
- 使用 先检查下载目录（~/Downloads、./data、./models、./vendor、node_modules 等可能的位置）是否已有目标内容；已有就复用，避免重复下载 而非 wget|curl|git clone|pip download|pip install -t|huggingface-cli download——重复下载浪费时间和带宽（尤其大模型权重几十 GB），可能覆盖正在使用的旧副本，甚至因网络问题下到损坏文件；先检查是一次极低成本的稳妥动作 [0.70]
- 使用 只用 | 作为分隔符。/ 在 unix 路径里太常见，会把含路径的 wrong_pattern 错切成超短 token，导致规则乱命中无关代码 而非 把 / 作为多模式分隔符之一（如 a|b|c 或 a/b/c 都视为多个候选）——0 号用户用 wget|curl|git clone|... 这种带 / 的合法字符串作为 wrong_pattern，被切成 src/__tests__/foo.js 这种短 token 后，每条含 src/ 的代码都被错误匹配 [0.70]
- 使用 把 IO 移到 adapter 层；core 必须保持纯函数。需要 IO 时通过依赖注入传入 而非 import fs——Functional Core Imperative Shell 是本项目的核心架构原则（CLAUDE.md 元约束）；core 含 IO 会破坏可测性和复用性 [0.70]
- 使用 通过 AttributionBus 发结构化事件；要 trace 用 process.stderr 或独立 logger 而非 console.log——Hook 进程的 stdout 是协议通道（返回 JSON 给 Claude Code），任何 console.log 都会污染协议导致解析失败 [0.70]
- 使用 vitest.config.ts 设置 pool:'threads' + poolOptions.threads.singleThread:true + fileParallelism:false 强制顺序跑 而非 使用默认的 thread pool 并发执行多个 test file——Windows + pnpm workspace + esbuild 组合下 vitest 多 worker 并发会出现 'Worker exited unexpectedly' / 'Out of memory' / 'memory allocation failed' 错误；singleThread 顺序跑可避免 [0.70]
- 使用 CLI E2E 测试脱离 vitest runner——用独立 shell 脚本跑，或等有长驻进程后在外层测；或改为函数级单元测试覆盖 bin 的分发逻辑 而非 vitest worker 内用 spawnSync('npx tsx', ...) 嵌套执行 CLI bin 文件做 E2E 测试——vitest worker 里再 fork tsx 加载 ESM loader 会放大内存占用，在 Windows 低内存环境下直接 OOM；vitest 不是做进程级 E2E 的合适场所 [0.70]
- 使用 完全退出当前 Claude Code 会话（Ctrl+D / 关窗口），重新启动后进入项目目录才能加载新 settings；subagent 沿用主会话 settings 缓存也无法验证 而非 在当前 Claude Code 会话内尝试触发 hook，或派发 subagent 来试——Claude Code 在会话启动时一次性载入 .claude/settings*.json，运行中不热加载。装完 hook 在原会话内调 Bash/Write/Edit 仍走旧配置（无 hook），容易陷入"以为装好实际没生效"的循环。直接验证 hook 进程本身正确性的方法：echo JSON | npx tsx <hook-bin>，如返回符合协议的 JSON 即逻辑无误，剩下只能等新会话 [0.70]
- 使用 用 tsup bundle 成单文件 .cjs（noExternal 所有 workspace 依赖和 zod 等），用 node <绝对正斜杠路径> 直接跑 而非 npx tsx——Claude Code 在 C:\Users\tianhaoxuan\AppData\Local\Temp cwd 里 spawn hook，npx 找不到 workspace；且 tsx 冷启动 1-2s，远超 Hook 50ms 延迟预算。bundle 后 node 启动毫秒级 [0.70]
- 使用 用正斜杠路径 C:/bzli/foo （Windows Node 和 bash 都认） 而非 用 Windows 反斜杠路径如 C:\\bzli\\foo 传给 bash 或 Claude Code hook——Git Bash 把 \\ 当转义符，C:\\bzli\\foo 在 shell 里会被解释为 Cbzlifoo，找不到文件；Claude Code 在 Windows 下默认通过 Git Bash 执行 hook command [0.70]
- 使用 入口处规范化：把 /c/foo 转成 C:/foo 再传给 Node IO API 而非 直接把 /c/bzli/teamagent 传给 path.join / fs.existsSync / path.resolve——Node on Windows 把 /c/... 当成根目录下的 c 文件夹（path.join 结果是 \\c\\...），不是 C 盘。Claude Code 在 Windows 下传给 hook 的 cwd 字段是 Git Bash 风格 /c/... 必须规范化 [0.70]
- 使用 务必加 scope.paths 或 scope.file_types 精确范围，例如 "scope.paths":["packages/core/**"] 或 "scope.file_types":["*.ts"] 而非 只写 wrong_pattern 不加 scope 范围限制——否则 matcher 对所有文件的命中关键词都拦，产生 false positive 打扰其他正当使用。例：no-fs-in-core 规则没限定 scope.paths 时，对任何 import fs 都拦，包括 install-hook.ts 这种本就该用 fs 的 adapter 层 [0.70]
- 使用 用精炼的字面关键词列表，用管道符分隔多个候选；例如 wget|curl|legacy-tool（这些就是 matcher 会做子串匹配的 token） 而非 用散文句子描述错误做法，例如 "直接调用下载类命令而不检查"——matcher 是子串匹配不是语义匹配。散文不会命中真实命令字符串。且含特殊符号的散文（中文括号、点号、斜杠）还可能被错切成无效 token [0.70]
- 使用 直接 claude （默认会话）；Hook 会被正常调用；只有 --bare 或 --dangerously-skip-permissions 会跳过 Hook 机制 而非 使用 --dangerously-skip-permissions 启动——今天 0 号用户实证：--dangerously-skip-permissions 启动的会话里 PreToolUse Hook 不会被执行——events.jsonl 零新增、对话里无 additional context。证据：claude -p（默认模式）新进程立刻产生 session-级别 events；--dangerously-skip-permissions 模式下同样操作零 event [0.70]
<!-- TEAMAGENT:END -->
