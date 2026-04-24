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

/** Cosine similarity between two equal-length numeric vectors. */
function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] as number;
    const bi = b[i] as number;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function semanticMatch(args: {
  contextText: string;
  actionText: string;
  embedder: RuleEmbedder;
  retriever: SemanticRetriever;
  scope: { level: "personal" | "team" | "global"; project?: string };
  topK?: number;
}): Promise<SemanticMatch[]> {
  const embedResult = await args.embedder.embed([
    args.contextText || " ",
    args.actionText || " ",
  ]);
  const ctxVec: number[] = embedResult[0] ?? [];
  const actVec: number[] = embedResult[1] ?? [];

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
      // Resolve hard_negatives: deserializeRow already JSON.parses into number[][],
      // but store may also hold a JSON string if the rule was partially migrated.
      const raw = (c.rule as any).hard_negatives;
      const hardNegVecs: number[][] = Array.isArray(raw)
        ? (raw as number[][])
        : (typeof raw === "string" && raw
            ? (() => { try { return JSON.parse(raw) as number[][]; } catch { return []; } })()
            : []);

      const hnSims = hardNegVecs.map((hn) => cosine(ctxVec, hn));

      const score = scoreSoftAnd({
        triggerSim: c.triggerSim,
        patternSim: c.patternSim,
        hardNegativeSims: hnSims,
      });

      const hardNegSim = hnSims.length > 0 ? Math.max(...hnSims) : 0;

      return {
        rule: c.rule,
        score,
        triggerSim: c.triggerSim,
        patternSim: c.patternSim,
        hardNegSim,
      };
    })
    .filter((m) => m.score > (m.rule.fire_threshold ?? 0.55))
    .sort((a, b) => b.score - a.score);
}

// TODO(Phase C): wire accumulateHardNegative in bin-stop.ts Step 6c.
// After Step 6b (semantic scan), read recent ai.override.ignored events from eventsDb,
// call accumulateHardNegative({ event, store: globalStore, embedder, now }) for each,
// and update rule hard_negatives via store.update(). This will populate hard_negatives
// so the cosine suppression above takes effect on subsequent calls.
