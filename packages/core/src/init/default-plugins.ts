/**
 * 团队标准插件 bundle。`teamagent install-plugins` 按本列表依次:
 *   1. 注册 marketplace（`claude plugin marketplace add`）
 *   2. 安装各 plugin（`claude plugin install <plugin>@<marketplace>`）
 *
 * 修改方式：直接编辑本文件；这是"团队标配"，单用户可以 `--plugins=<list>`
 * 或 `teamagent plugin uninstall` 运行时覆盖。
 */

export interface MarketplaceSpec {
  readonly name: string;
  readonly repo: string;
}

export interface PluginSpec {
  readonly plugin: string;
  readonly marketplace: string;
}

export const DEFAULT_MARKETPLACES: readonly MarketplaceSpec[] = [
  { name: "claude-plugins-official", repo: "anthropics/claude-plugins-official" },
  { name: "knowledge-work-plugins", repo: "anthropics/knowledge-work-plugins" },
  { name: "caveman", repo: "JuliusBrussee/caveman" },
];

export const DEFAULT_PLUGINS: readonly PluginSpec[] = [
  { plugin: "superpowers", marketplace: "claude-plugins-official" },
  { plugin: "playground", marketplace: "claude-plugins-official" },
  { plugin: "sales", marketplace: "knowledge-work-plugins" },
  { plugin: "caveman", marketplace: "caveman" },
];

export function parsePluginSpec(raw: string): PluginSpec {
  const spec = raw.trim();
  const atIdx = spec.indexOf("@");
  if (atIdx <= 0 || atIdx === spec.length - 1) {
    throw new Error(`invalid plugin spec: "${raw}" (expected "plugin@marketplace")`);
  }
  return {
    plugin: spec.slice(0, atIdx),
    marketplace: spec.slice(atIdx + 1),
  };
}

export function formatPluginSpec(p: PluginSpec): string {
  return `${p.plugin}@${p.marketplace}`;
}
