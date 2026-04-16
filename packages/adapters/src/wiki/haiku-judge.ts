import type { LLMClient, RawWikiItem } from "@teamagent/ports";
import type { JudgedWikiItem } from "@teamagent/core";

export class HaikuJudge {
  constructor(
    private llm: LLMClient,
    private batchSize = 10,
  ) {}

  async judge(items: RawWikiItem[], stack: string[]): Promise<JudgedWikiItem[]> {
    if (items.length === 0) return [];

    const results: JudgedWikiItem[] = [];

    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const judged = await this.judgeBatch(batch, stack);
      results.push(...judged);
    }

    return results;
  }

  private async judgeBatch(items: RawWikiItem[], stack: string[]): Promise<JudgedWikiItem[]> {
    const prompt = buildJudgePrompt(items, stack);
    const raw = await this.llm.complete(prompt);
    return parseJudgeResponse(raw, items);
  }
}

export function buildJudgePrompt(items: RawWikiItem[], stack: string[]): string {
  const itemsText = items
    .map(
      (item) =>
        `--- sourceId: ${item.sourceId}\ntitle: ${item.title}\ncontent: ${item.content}`,
    )
    .join("\n");

  return `You are evaluating tech knowledge snippets for a developer knowledge base.
Project stack: ${stack.join(", ")}

For each item, decide: is this genuinely useful to a developer using this stack?
Useful = new API, breaking change, deprecation, important bug fix, best practice update.
Not useful = marketing, minor patch notes, unrelated ecosystem, opinion without action.

Return JSON array only (no markdown, no explanation):
[{
  "sourceId": "...",
  "valuable": true|false,
  "tldr": "1-2 sentences max",
  "keywords": ["keyword1", "keyword2"],
  "rejectReason": "reason or null"
}]

Items:
${itemsText}`;
}

interface JudgeResult {
  sourceId: string;
  valuable: boolean;
  tldr: string;
  keywords: string[];
  rejectReason: string | null;
}

export function parseJudgeResponse(raw: string, items: RawWikiItem[]): JudgedWikiItem[] {
  // Try to extract JSON from markdown code block if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch?.[1]?.trim() ?? raw.trim();

  let parsed: JudgeResult[];
  try {
    parsed = JSON.parse(jsonText) as JudgeResult[];
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }
  } catch {
    // On parse failure: mark all items as not valuable
    return items.map((item) => ({
      ...item,
      tldr: "",
      keywords: [],
      valuable: false,
      rejectReason: "parse error",
    }));
  }

  // Build a lookup map from sourceId to parsed result
  const resultMap = new Map<string, JudgeResult>();
  for (const r of parsed) {
    if (r.sourceId) {
      resultMap.set(r.sourceId, r);
    }
  }

  return items.map((item) => {
    const r = resultMap.get(item.sourceId);
    if (!r) {
      return {
        ...item,
        tldr: "",
        keywords: [],
        valuable: false,
        rejectReason: "not in response",
      };
    }
    return {
      ...item,
      tldr: r.tldr ?? "",
      keywords: Array.isArray(r.keywords) ? r.keywords : [],
      valuable: Boolean(r.valuable),
      rejectReason: r.rejectReason ?? undefined,
    };
  });
}
