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
## TeamAgent 经验（38条活跃知识）
- 使用 demote=0 时返回 enforced（无约束），让 effectiveTier 能产出比当前 tier 高的候选 而非 demote=0 时返回 currentTier，effectiveTier 永远无法升级—— [0.70]
- 使用 const enteredMs = input.tier_entered_at ? new Date(input.tier_entered_at).getTime() : 0；显式判空再计算 而非 new Date("") 产生 Invalid Date，daysSince=NaN，NaN<7=false 导致 7 天降级保护被静默绕过—— [0.70]
- 使用 tierFromDemerit 的返回值是死亡链允许的最高 tier；无约束（demote=0）应返回 enforced，测试必须反映此语义 而非 测试写 tierFromDemerit(4, 'stable') → 'stable' 表示无约束时返回 currentTier—— [0.70]
- 使用 先在 packages/types/src/attribution.ts 的 source union 加成员，再 emit 而非 直接在 pipeline emit 新 source 值——AttributionEvent.source 是闭合 union；新组件 emit 未声明的 source 值 TS 编译就挂 [0.70]
- 使用 dry-run 只跳过 store.add；extractor/L1/L2 仍会调用 LLM。想零 LLM 预览用 --from-git/--from-ci 半自动源 而非 以为 dry-run 不花 LLM 费用——ingest-pipeline 的 dryRun 只是 store.add 的 bypass，不控制 LLM 调用链路——extractor 仍要跑，按源计费 [0.70]
- 使用 先在 packages/adapters/package.json 的 exports 字段加 './xxx': './src/xxx.ts'，再 import 而非 新建 src/xxx.ts 就直接 import @teamagent/adapters/xxx——pnpm workspace 包的 exports 字段是 API 边界；未声明的 subpath 在安装/构建阶段解析失败。M2.3 加 ingest/* 时踩过这个节拍 [0.70]
- 使用 通过目标包 package.json 的 exports 字段暴露 subpath（例如 "./contracts"）再 import 而非 import ... from "@teamagent/ports/src/__tests__/xxx.js"——workspace 包的 exports 字段是 API 边界，pnpm/vite 不会解析未暴露的深路径；深路径 import 会在安装后构建阶段失败 [0.00]
- 使用 passive 在打分公式里仍有 0.1 权重，所以 passive 条目 score 最低为 0.01（0.1 × 0.1） 而非 期望 passive 条目 score=0——spec v5.2 评分公式: confidence×0.4 + hit×0.3 + recency×0.2 + enforcement×0.1；passive 不是 0 分，只是最小分 [0.00]
- 使用 先检查下载目录（~/Downloads、./data、./models、./vendor、node_modules 等可能的位置）是否已有目标内容；已有就复用，避免重复下载 而非 wget|curl|git clone|pip download|pip install -t|huggingface-cli download——重复下载浪费时间和带宽（尤其大模型权重几十 GB），可能覆盖正在使用的旧副本，甚至因网络问题下到损坏文件；先检查是一次极低成本的稳妥动作 [0.00]
- 使用 只用 | 作为分隔符。/ 在 unix 路径里太常见，会把含路径的 wrong_pattern 错切成超短 token，导致规则乱命中无关代码 而非 把 / 作为多模式分隔符之一（如 a|b|c 或 a/b/c 都视为多个候选）——0 号用户用 wget|curl|git clone|... 这种带 / 的合法字符串作为 wrong_pattern，被切成 src/__tests__/foo.js 这种短 token 后，每条含 src/ 的代码都被错误匹配 [0.00]
- 使用 把 IO 移到 adapter 层；core 必须保持纯函数。需要 IO 时通过依赖注入传入 而非 import fs——Functional Core Imperative Shell 是本项目的核心架构原则（CLAUDE.md 元约束）；core 含 IO 会破坏可测性和复用性 [0.00]
- 使用 通过 AttributionBus 发结构化事件；要 trace 用 process.stderr 或独立 logger 而非 console.log——Hook 进程的 stdout 是协议通道（返回 JSON 给 Claude Code），任何 console.log 都会污染协议导致解析失败 [0.00]
- 使用 core 只能依赖 @teamagent/types 和 @teamagent/ports；纯函数逻辑必须放在 core，adapter 只做 IO 包装 而非 @teamagent/adapters——Hexagonal Architecture 依赖方向: core 依赖 ports 接口，adapters 实现 ports。core import adapters 会反转依赖方向，打破可测性和组合性 [0.00]
- 使用 用相对路径 import { x } from "../packages/core/src/index.js"；或给 scripts/ 建 package.json 加入 pnpm-workspace.yaml 而非 在 scripts/*.ts 里 import { x } from "@teamagent/core"——pnpm workspace 只把 pnpm-workspace.yaml 中声明的目录视为可 resolve 的 @scope/name；顶层 scripts/ 不在其中，tsx/node 会 ERR_MODULE_NOT_FOUND [0.00]
- 使用 让依赖方直接 import 源头 detector.detect() 拿结果作为输入；纯函数间互相调用是安全的 而非 在每个 detector 内各自复制 denial/praise 等关键词表，并各自判定一遍——重复的关键词表会在一处更新时漏改，导致两个 detector 语义分歧；依赖调用比复制逻辑更耦合但更正确——单一事实源 [0.00]
- 使用 fetch 而非 axios——项目约定使用原生 fetch 以减少依赖；axios 不符合该约定 [0.00]
- 使用 Zustand 而非 Redux Toolkit|@reduxjs/toolkit|redux——用户偏好轻量方案；Redux Toolkit 虽然功能完整但样板代码和学习成本高，Zustand API 极简、包体积小，更符合项目轻量化倾向 [0.00]
- 泛型签名 + leading/trailing 选项 + cancel 方法——debounce 这类工具函数在真实项目里常需要控制首次/末次触发和取消能力；只写最简版会导致调用方反复重写或封装，泛型可保留参数类型不丢失 [0.00]
- 使用 batch insert 一次性批量插入 而非 循环逐条插入|for.*insert|loop insert——逐条插入每次都有网络往返和事务开销，几百条就会明显变慢；batch insert 一次请求完成，性能通常高一到两个数量级 [0.00]
- 先跑 cd packages/cli && pnpm build:hook 重编 dist/bin-pre-tool-use.cjs，再关窗重开 Claude Code 让新 bundle 生效——Claude Code Hook 跑的是 tsup 打包后的单文件 .cjs bundle，不是源码。core 改了但 bundle 没 rebuild，Hook 继续用旧代码且不会报任何错，症状会变得难以归因（本项目真实踩过：修完 scope 语义 bug 后没 rebuild，导致带 file_types 的规则对 Bash 全部失效） [0.00]
- 若调用方 deps.scope 未设 paths 或 file_types，自动注入 DEFAULT_CODE_FILE_TYPES（ts/tsx/js/py/go/rs/... 不含 md/txt/rst）；显式设过 scope 范围则不覆盖——规则的 wrong_pattern 会在讨论该规则的 md 文档里被 matcher 命中，造成规则在自己的 docs 里反噬；DEFAULT_CODE_FILE_TYPES 作为安全网把文档排除在外。M4 dogfood 时真实出现：刚提取的 batch-insert 规则直接拦住本次评测文档的写入。更理想的方案是 prompt 让 LLM 推断 project-aware 的 scope.paths，但那是 M5/M6 功能；默认 file_types 是 M4 完成时的最小安全保障 [0.00]
- 使用 ctx 无 file_path 时直接放行 scope 检查；只在有 file_path 时才校验 file_types/paths。语义是：scope 限制'哪些文件由规则覆盖'，不是'规则是否参与匹配' 而非 if (rule.scope.file_types && !filePath) return false  // 这让 Bash/WebFetch 等无 file_path 的操作被全部拦住——若反向实现，带 scope 的规则会对所有非文件操作（Bash 命令、网络请求）失效；一旦给规则统一加了默认 file_types 后，Bash 就全部静默——极难 debug（本项目真实踩过：修完后 git commit 含 axios 的消息竟不触发 hook，溯源才发现是旧 bundle + 新 scope 数据的组合效应） [0.00]
- 使用 vitest.config.ts 设置 pool:'threads' + poolOptions.threads.singleThread:true + fileParallelism:false 强制顺序跑 而非 使用默认的 thread pool 并发执行多个 test file——Windows + pnpm workspace + esbuild 组合下 vitest 多 worker 并发会出现 'Worker exited unexpectedly' / 'Out of memory' / 'memory allocation failed' 错误；singleThread 顺序跑可避免 [0.00]
- 使用 CLI E2E 测试脱离 vitest runner——用独立 shell 脚本跑，或等有长驻进程后在外层测；或改为函数级单元测试覆盖 bin 的分发逻辑 而非 vitest worker 内用 spawnSync('npx tsx', ...) 嵌套执行 CLI bin 文件做 E2E 测试——vitest worker 里再 fork tsx 加载 ESM loader 会放大内存占用，在 Windows 低内存环境下直接 OOM；vitest 不是做进程级 E2E 的合适场所 [0.00]
- 使用 完全退出当前 Claude Code 会话（Ctrl+D / 关窗口），重新启动后进入项目目录才能加载新 settings；subagent 沿用主会话 settings 缓存也无法验证 而非 在当前 Claude Code 会话内尝试触发 hook，或派发 subagent 来试——Claude Code 在会话启动时一次性载入 .claude/settings*.json，运行中不热加载。装完 hook 在原会话内调 Bash/Write/Edit 仍走旧配置（无 hook），容易陷入"以为装好实际没生效"的循环。直接验证 hook 进程本身正确性的方法：echo JSON | npx tsx <hook-bin>，如返回符合协议的 JSON 即逻辑无误，剩下只能等新会话 [0.00]
- 使用 用 tsup bundle 成单文件 .cjs（noExternal 所有 workspace 依赖和 zod 等），用 node <绝对正斜杠路径> 直接跑 而非 npx tsx——Claude Code 在 C:\Users\tianhaoxuan\AppData\Local\Temp cwd 里 spawn hook，npx 找不到 workspace；且 tsx 冷启动 1-2s，远超 Hook 50ms 延迟预算。bundle 后 node 启动毫秒级 [0.00]
- 使用 用正斜杠路径 C:/bzli/foo （Windows Node 和 bash 都认） 而非 用 Windows 反斜杠路径如 C:\\bzli\\foo 传给 bash 或 Claude Code hook——Git Bash 把 \\ 当转义符，C:\\bzli\\foo 在 shell 里会被解释为 Cbzlifoo，找不到文件；Claude Code 在 Windows 下默认通过 Git Bash 执行 hook command [0.00]
- 使用 入口处规范化：把 /c/foo 转成 C:/foo 再传给 Node IO API 而非 直接把 /c/bzli/teamagent 传给 path.join / fs.existsSync / path.resolve——Node on Windows 把 /c/... 当成根目录下的 c 文件夹（path.join 结果是 \\c\\...），不是 C 盘。Claude Code 在 Windows 下传给 hook 的 cwd 字段是 Git Bash 风格 /c/... 必须规范化 [0.00]
- 使用 务必加 scope.paths 或 scope.file_types 精确范围，例如 "scope.paths":["packages/core/**"] 或 "scope.file_types":["*.ts"] 而非 只写 wrong_pattern 不加 scope 范围限制——否则 matcher 对所有文件的命中关键词都拦，产生 false positive 打扰其他正当使用。例：no-fs-in-core 规则没限定 scope.paths 时，对任何 import fs 都拦，包括 install-hook.ts 这种本就该用 fs 的 adapter 层 [0.00]
- 使用 用精炼的字面关键词列表，用管道符分隔多个候选；例如 wget|curl|legacy-tool（这些就是 matcher 会做子串匹配的 token） 而非 用散文句子描述错误做法，例如 "直接调用下载类命令而不检查"——matcher 是子串匹配不是语义匹配。散文不会命中真实命令字符串。且含特殊符号的散文（中文括号、点号、斜杠）还可能被错切成无效 token [0.00]
- 使用 直接 claude （默认会话）；Hook 会被正常调用；只有 --bare 或 --dangerously-skip-permissions 会跳过 Hook 机制 而非 使用 --dangerously-skip-permissions 启动——今天 0 号用户实证：--dangerously-skip-permissions 启动的会话里 PreToolUse Hook 不会被执行——events.jsonl 零新增、对话里无 additional context。证据：claude -p（默认模式）新进程立刻产生 session-级别 events；--dangerously-skip-permissions 模式下同样操作零 event [0.00]
- 使用 用 process.cwd() —— vitest 从 repo 根启动，cwd 可靠。或直接用 packages-local 相对路径 而非 path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../../..")——多层 ".." 退路径容易少退一层或多退一层，且 url.pathname 在 Windows 上前缀 / 还需处理。process.cwd() 零歧义 [0.00]
- 使用 中文场景去掉 \\b，用显式锚点或前后文字符类。\\b 只在 ASCII 单词字符边界工作 而非 正则用 \\b 包裹中文词，例如 /\\b(用|改用|上)\\s*X\\b/——\\b 定义为 \\w 与非 \\w 之间的边界；中文字符不属于 JavaScript 的 \\w（默认没开 /u 标志时），"用" 前后不产生 boundary，正则永远不会命中 [0.00]
- 使用 经 stdin 传 prompt；args 只放 flags：['-p', '--output-format', 'json', '--no-session-persistence']，然后 child.stdin.write(prompt) + end() 而非 把 prompt 当 positional arg 传给 claude -p，例如 args=['-p', fullPrompt, '--output-format', 'json']——Windows 命令行长度有 ~8KB 限制，extraction/evaluation 等真实 prompt 一般 2-5KB，positional arg 不稳定；stdin 同时免去特殊字符转义。实证：echo '...' | claude -p --output-format json --no-session-persistence 正常返回 {type:'result', result:'...'} [0.00]
- 先写失败测试（红）→ 写最小实现（绿）→ 重构（如需）→ commit——TDD 让接口设计先行，测试与实现紧耦合；避免写完实现才发现接口难用 [0.00] [预置]
- 一个 commit 只做一件概念上完整的事，tests 要过；commit message 说清'做了什么+为什么'——小 commit 让 review 容易、回滚粒度细、git bisect 有意义；批量提交会让 bug 定位变噩梦 [0.00] [预置]
- 用 teamagent pitfall（交互）或 teamagent pitfall --non-interactive --trigger=... --correct=... 录入；不要手工编辑 .teamagent/knowledge.jsonl——pitfall 命令会补齐 id/时间戳/scope/enforcement 等字段并触发 CLAUDE.md 重编译；手工编辑容易写出不合 schema 的条目、忘记重新编译 [0.00] [预置]
- 先确认项目里有没有已有文件能承载该改动；优先编辑现有文件，只在真的需要时才新建——不必要的新文件会让 reviewer 分心、让 import 关系复杂；大多数小改动应该在现有模块里完成 [0.00] [预置]
<!-- TEAMAGENT:END -->
