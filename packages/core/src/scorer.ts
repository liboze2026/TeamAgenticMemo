import type { KnowledgeEntry } from "@teamagent/types";

/**
 * 知识条目优先级评分。纯函数。
 *
 * 公式（对齐 spec v5.2）：
 *   score = confidence × 0.4
 *         + (hit_count / maxHitCount) × 0.3
 *         + recency × 0.2
 *         + enforcement_weight × 0.1
 *
 * 其中 recency = max(0, 1 - daysSinceLastHit / 90)（90 天线性衰减）。
 */
export function scoreEntry(
  entry: KnowledgeEntry,
  maxHitCount: number,
  now: string,
): number {
  const confidenceScore = entry.confidence * 0.4;

  const hitNormalized = maxHitCount > 0 ? entry.hit_count / maxHitCount : 0;
  const hitScore = hitNormalized * 0.3;

  const nowMs = Date.parse(now);
  const hitMs = entry.last_hit_at ? Date.parse(entry.last_hit_at) : 0;
  const daysSinceHit = hitMs > 0 ? (nowMs - hitMs) / (1000 * 60 * 60 * 24) : 90;
  const recency = Math.max(0, 1 - daysSinceHit / 90);
  const recencyScore = recency * 0.2;

  const enforcementScore = ENFORCEMENT_WEIGHT[entry.enforcement] * 0.1;

  return confidenceScore + hitScore + recencyScore + enforcementScore;
}

const ENFORCEMENT_WEIGHT: Record<KnowledgeEntry["enforcement"], number> = {
  block: 1.0,
  warn: 0.7,
  suggest: 0.4,
  passive: 0.1,
};
