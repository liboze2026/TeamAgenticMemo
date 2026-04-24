<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验（22条活跃知识）
- 使用 跑完实际验证命令（构建+启动+测试）并贴出真实输出再宣布完成 而非 全部修复完成——用户反复看到 AI 宣称修复完还残留 bug，说明 AI 基于局部证据（如单测绿）就下结论；完成声明必须以端到端验证输出为证据，否则等于骗用户 [0.90] [预置]
- 只加新键 + 先 backup；沿用 packages/core/src/init/meta-principles.ts 现有 4 条元原则；默认插件列表 = superpowers + caveman + sales + playground + claude-plugins-official（不含 gstack）——用户级配置属共享状态，覆盖写会毁他人设置——只增键加 backup 可回滚；元原则已硬编码稳定，不需重新设计；gstack 非团队默认需求，默认列表要贴团队实际用法 [0.95]
- 改 ~/.claude/settings.json 或 known_marketplaces.json 只加新键 + 先 backup；团队元原则复用 packages/core/src/init/meta-principles.ts 现有 4 条；默认插件列表仅 superpowers + caveman + sales + playground + claude-plugins-official，不含 gstack——用户级配置属共享状态，覆盖已有键会毁用户自定义；先 backup + 增量合并可回滚。元原则已硬编码无需重造。gstack 非团队必需，默认列表要精简避免污染用户环境 [0.95]
- 仅基于失败状态判断，去掉用户消息的约束——系统应主动从所有失败中自动学习规则，不依赖用户显式纠正，提高自进化的自动化程度和覆盖范围 [0.95]
- 一次 init，所有项目共享规则库——避免规则碎片化和重复初始化，提高知识共享和学习效率 [0.95]
- 批量读取 + 批量修改，而非逐条分析——逐条分析大数据浪费 token 和时间；批量操作提高效率且节省成本，特别适用于规则库、配置等数据清洁任务 [0.95]
- 批量一次性读取→修改，避免逐条分别分析——逐条分析多条规则导致 token 消耗线性增长；批量处理能显著降低成本，适用于规则清洗、数据迁移等场景 [0.95]
- 用通俗语言逐层讲解，避免术语堆砌；用具体例子和比喻辅助理解——用户不一定是该系统内部开发者；内部术语和紧凑表述增加认知负荷；通俗讲解能更快建立理解，特别是首次接触概念时 [0.90]
- 提供元原则（字面稳定、可substring命中、脱离上下文仍指向问题）+ 跨领域代表例，让LLM泛化——穷举表容易遗漏且难以泛化；元原则+代表例让模型理解本质，能自主识别遗漏的反模式 [0.80]
- 使用 process.chdir then path.resolve, or C:/bzli/... format 而非 DatabaseSync('/c/bzli/...')——node:sqlite uses Win32 API, does not recognize Git Bash /c/ mountpoint [0.70]
- 使用 use pnpm teamagent <cmd>, or build first then node dist/bin-stop.cjs 而非 node --input-type=module importing packages that re-export .ts source files——adapters/dist/index.js re-exports from .ts source, fails without tsx. Only the bundled bin-stop.cjs / bin.js are runnable standalone [0.70]
<!-- TEAMAGENT:END -->
