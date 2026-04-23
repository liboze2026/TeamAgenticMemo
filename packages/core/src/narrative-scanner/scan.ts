import type { KnowledgeEntry } from "@teamagent/types";
import { normalizeChannel } from "@teamagent/types";

/**
 * M4-A 叙事扫描器。
 *
 * 在 Stop hook pipeline 尾部运行：
 * - 读取最近一轮 AI assistant 输出文本
 * - 对所有 channel=ai-narrative 且 status=active 的规则做子串匹配
 * - 命中则产出 NarrativeHit 供后续写入 pending_warnings
 *
 * 纯函数，无 IO 副作用。复用与 PreToolUse matcher 相同的切词策略。
 */

export interface NarrativeHit {
  knowledge_id: string;
  matched_snippet: string;
  rule_summary: string;
  confidence: number;
  correct_pattern: string;
  reasoning: string;
}

const MIN_TOKEN_LENGTH = 3;

function splitPatterns(raw: string): string[] {
  const tokens = raw
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_TOKEN_LENGTH);
  return tokens.length > 0 ? tokens : [raw.trim()];
}

function snippet(haystack: string, needle: string, pad = 20): string {
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return needle;
  const start = Math.max(0, idx - pad);
  const end = Math.min(haystack.length, idx + needle.length + pad);
  return haystack.slice(start, end);
}

function summarize(rule: KnowledgeEntry): string {
  return rule.correct_pattern || rule.reasoning || rule.wrong_pattern || rule.id;
}

export function scanNarrative(
  text: string,
  rules: KnowledgeEntry[],
): NarrativeHit[] {
  if (!text) return [];
  if (rules.length === 0) return [];
  const hits: NarrativeHit[] = [];
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (rule.status !== "active") continue;
    if (!rule.wrong_pattern) continue;
    if (normalizeChannel((rule as any).channel) !== "ai-narrative") continue;
    const patterns = splitPatterns(rule.wrong_pattern);
    for (const p of patterns) {
      if (p.length === 0) continue;
      if (lower.includes(p.toLowerCase())) {
        hits.push({
          knowledge_id: rule.id,
          matched_snippet: snippet(text, p),
          rule_summary: summarize(rule),
          confidence: rule.confidence,
          correct_pattern: rule.correct_pattern,
          reasoning: rule.reasoning,
        });
        break;
      }
    }
  }
  return hits;
}
