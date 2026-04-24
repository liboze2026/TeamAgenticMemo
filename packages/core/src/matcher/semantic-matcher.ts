import type { RuleEmbedder, SemanticRetriever } from "@teamagent/ports";
import type { KnowledgeEntry } from "@teamagent/types";
import { scoreSoftAnd } from "./soft-and-scorer.js";

export interface SemanticMatch {
  rule: KnowledgeEntry;
  score: number;
  triggerSim: number;
  patternSim: number;
  hardNegSim: number;
}

export async function semanticMatch(args: {
  contextText: string;
  actionText: string;
  embedder: RuleEmbedder;
  retriever: SemanticRetriever;
  scope: { level: "personal" | "team" | "global"; project?: string };
  topK?: number;
}): Promise<SemanticMatch[]> {
  const [ctxVec, actVec] = await args.embedder.embed([
    args.contextText || " ",
    args.actionText || " ",
  ]);

  const candidates = await args.retriever.retrieve({
    contextText: args.contextText,
    actionText: args.actionText,
    contextVec: new Float32Array(ctxVec),
    actionVec: new Float32Array(actVec),
    scope: args.scope,
    topK: args.topK,
  });

  return candidates
    .map((c) => {
      const score = scoreSoftAnd({
        triggerSim: c.triggerSim,
        patternSim: c.patternSim,
        hardNegativeSims: [],
      });

      return {
        rule: c.rule,
        score,
        triggerSim: c.triggerSim,
        patternSim: c.patternSim,
        hardNegSim: 0,
      };
    })
    .filter((m) => m.score > (m.rule.fire_threshold ?? 0.55))
    .sort((a, b) => b.score - a.score);
}
