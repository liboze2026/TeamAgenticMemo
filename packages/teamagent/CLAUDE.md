<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验（19条活跃知识）
- 只加新键 + 先 backup；沿用 packages/core/src/init/meta-principles.ts 现有 4 条元原则；默认插件列表 = superpowers + caveman + sales + playground + claude-plugins-official（不含 gstack）——用户级配置属共享状态，覆盖写会毁他人设置——只增键加 backup 可回滚；元原则已硬编码稳定，不需重新设计；gstack 非团队默认需求，默认列表要贴团队实际用法 [0.95]
- 改 ~/.claude/settings.json 或 known_marketplaces.json 只加新键 + 先 backup；团队元原则复用 packages/core/src/init/meta-principles.ts 现有 4 条；默认插件列表仅 superpowers + caveman + sales + playground + claude-plugins-official，不含 gstack——用户级配置属共享状态，覆盖已有键会毁用户自定义；先 backup + 增量合并可回滚。元原则已硬编码无需重造。gstack 非团队必需，默认列表要精简避免污染用户环境 [0.95]
- 使用 process.chdir then path.resolve, or C:/bzli/... format 而非 DatabaseSync('/c/bzli/...')——node:sqlite uses Win32 API, does not recognize Git Bash /c/ mountpoint [0.70]
- 使用 use pnpm teamagent <cmd>, or build first then node dist/bin-stop.cjs 而非 node --input-type=module importing packages that re-export .ts source files——adapters/dist/index.js re-exports from .ts source, fails without tsx. Only the bundled bin-stop.cjs / bin.js are runnable standalone [0.70]
<!-- TEAMAGENT:END -->
