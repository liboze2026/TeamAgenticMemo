export function extractQueryKeywords(prompt: string): string[] {
  const keywords = new Set<string>();

  // import/from statements: import X from 'pkg' or import { X } from 'pkg'
  const importFromRe = /(?:from|import)\s+['"](@?[\w\-\/\.]+)['"]/g;
  for (const m of prompt.matchAll(importFromRe)) {
    keywords.add((m[1] as string).replace(/^@/, "").split("/")[0] as string);
  }

  // require('pkg') calls
  const requireRe = /require\s*\(\s*['"](@?[\w\-\/\.]+)['"]\s*\)/g;
  for (const m of prompt.matchAll(requireRe)) {
    keywords.add((m[1] as string).replace(/^@/, "").split("/")[0] as string);
  }

  // npm/yarn/pnpm/pip install commands
  const installRe = /(?:npm install|yarn add|pnpm add|pip install|go get)\s+([\w\-@\/\.]+)/g;
  for (const m of prompt.matchAll(installRe)) {
    keywords.add((m[1] as string).replace(/^@/, "").split("/")[0] as string);
  }

  // pkg@version pattern
  const versionRe = /([\w\-]+)@[\d\.]+/g;
  for (const m of prompt.matchAll(versionRe)) {
    keywords.add(m[1] as string);
  }

  return [...keywords];
}

export function buildQueryText(keywords: string[], promptFallback: string): string {
  if (keywords.length === 0) return promptFallback.slice(0, 200);
  return keywords.join(" ");
}
