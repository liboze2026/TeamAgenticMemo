export interface WikiHint {
  tldr: string;
  sourceType: string;
  publishedAt: Date;
}

export function formatInjection(entries: WikiHint[]): string {
  if (entries.length === 0) return "";

  const lines = entries.map((e) => {
    const month = e.publishedAt.toISOString().slice(0, 7);
    return `  - ${e.tldr} (${e.sourceType} ${month})`;
  });

  return [
    "---",
    "📚 [WIKI HINT — 若本次回答涉及以下主题，请在末尾添加",
    '    "💡 Latest Wiki" 小节（每条 1-2 行，引用来源）：]',
    ...lines,
    "---",
  ].join("\n");
}
