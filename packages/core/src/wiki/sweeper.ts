export interface WikiEntrySnapshot {
  knowledgeId: string;
  sourceType: string;
  sourceId: string;
  publishedAt: Date;
  fetchedAt: Date;
  inlineInjectionCount: number;
}

export interface SweepPolicy {
  zeroHitMinAgeDays: number;
  perSourceKeep: number;
  now: Date;
}

export type ArchiveReason = "zero-hit-aged" | "source-overflow";

export interface ArchiveDecision {
  knowledgeId: string;
  reason: ArchiveReason;
}

const MS_PER_DAY = 86_400_000;

export function computeArchivals(
  entries: readonly WikiEntrySnapshot[],
  policy: SweepPolicy,
): ArchiveDecision[] {
  const decisions = new Map<string, ArchiveDecision>();

  // rule 1: zero-hit + aged
  for (const e of entries) {
    const ageDays = (policy.now.getTime() - e.fetchedAt.getTime()) / MS_PER_DAY;
    if (e.inlineInjectionCount === 0 && ageDays > policy.zeroHitMinAgeDays) {
      decisions.set(e.knowledgeId, { knowledgeId: e.knowledgeId, reason: "zero-hit-aged" });
    }
  }

  // rule 2: per-source keep top N by publishedAt desc
  const bySource = new Map<string, WikiEntrySnapshot[]>();
  for (const e of entries) {
    const key = e.sourceId;
    const bucket = bySource.get(key) ?? [];
    bucket.push(e);
    bySource.set(key, bucket);
  }
  for (const bucket of bySource.values()) {
    if (bucket.length <= policy.perSourceKeep) continue;
    bucket.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    for (const e of bucket.slice(policy.perSourceKeep)) {
      if (!decisions.has(e.knowledgeId)) {
        decisions.set(e.knowledgeId, { knowledgeId: e.knowledgeId, reason: "source-overflow" });
      }
    }
  }

  return Array.from(decisions.values());
}
