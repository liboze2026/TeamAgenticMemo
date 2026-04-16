import type {
  CalibratorV2,
  KnowledgeStore,
  AttributionBus,
  Observation,
  TierTransition,
  DeltaStep,
} from "@teamagent/ports";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

export interface CalibrationV2Deps {
  calibrator: CalibratorV2;
  store: KnowledgeStore;
  events: PersistedEvent[];
  observations: Observation[];
  bus?: AttributionBus;
  now: () => Date;
  dryRun?: boolean;
}

export interface CalibrationV2Record {
  knowledge_id: string;
  confidence_before: number;
  confidence_after: number;
  demerit_before: number;
  demerit_after: number;
  tier_before: string;
  tier_after: string;
  tier_transition: TierTransition | null;
  delta_breakdown: DeltaStep[];
}

export interface CalibrationV2Result {
  scanned: number;
  adjusted: CalibrationV2Record[];
  dormantNew: string[];
}

export async function runCalibrationPipelineV2(
  deps: CalibrationV2Deps,
): Promise<CalibrationV2Result> {
  const entries = deps.store.getAll();
  const now = deps.now();

  const obsIdx = indexByKnowledgeId(deps.observations);
  const evtIdx = indexByKnowledgeId(deps.events);

  const adjusted: CalibrationV2Record[] = [];
  const dormantNew: string[] = [];

  for (const entry of entries) {
    if (entry.status === "archived" || entry.status === "dormant") continue;
    const obsForEntry = obsIdx.get(entry.id) ?? [];
    const evtForEntry = evtIdx.get(entry.id) ?? [];
    if (obsForEntry.length === 0 && evtForEntry.length === 0 && entry.demerit === 0) {
      continue; // no signal
    }

    const result = deps.calibrator.calibrate(entry, {
      events: evtForEntry as PersistedEvent[],
      observations: obsForEntry as Observation[],
      now,
    });

    const confChanged = Math.abs(result.confidence_delta) > 1e-6;
    const demChanged = Math.abs(result.demerit_delta) > 1e-6;
    const tierChanged = result.tier_transition !== null;
    if (!confChanged && !demChanged && !tierChanged) continue;

    if (!deps.dryRun) {
      deps.store.update(entry.id, {
        confidence: result.confidence,
        demerit: result.demerit,
        current_tier: result.tier_after,
        status: result.status,
        demerit_last_updated: now.toISOString(),
        tier_entered_at: tierChanged ? now.toISOString() : entry.tier_entered_at,
        max_tier_ever:
          tierChanged && tierRankGt(result.tier_after, entry.max_tier_ever)
            ? result.tier_after
            : entry.max_tier_ever,
        last_validated_at: now.toISOString(),
      } as Partial<KnowledgeEntry>);
    }

    if (result.tier_after === "dormant") {
      dormantNew.push(entry.id);
    }

    adjusted.push({
      knowledge_id: entry.id,
      confidence_before: entry.confidence,
      confidence_after: result.confidence,
      demerit_before: entry.demerit,
      demerit_after: result.demerit,
      tier_before: result.tier_before,
      tier_after: result.tier_after,
      tier_transition: result.tier_transition,
      delta_breakdown: result.delta_breakdown,
    });

    deps.bus?.emit({
      source: "calibrator",
      action: "v2_adjusted",
      target: { id: entry.id },
      before: { confidence: entry.confidence, tier: entry.current_tier, demerit: entry.demerit },
      after: { confidence: result.confidence, tier: result.tier_after, demerit: result.demerit },
      severity: result.tier_after === "dormant" ? "warning" : "info",
      userFacingValue:
        result.tier_transition
          ? `${entry.id}: ${result.tier_before} → ${result.tier_after} (${result.tier_transition.reason})`
          : `${entry.id}: conf ${entry.confidence.toFixed(2)} → ${result.confidence.toFixed(2)}`,
      timestamp: now.toISOString(),
    });
  }

  return { scanned: entries.length, adjusted, dormantNew };
}

function indexByKnowledgeId<T extends { knowledge_id?: string }>(
  items: T[],
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    if (!it.knowledge_id) continue;
    const list = m.get(it.knowledge_id);
    if (list) list.push(it);
    else m.set(it.knowledge_id, [it]);
  }
  return m;
}

const TIER_RANK: Record<string, number> = {
  experimental: 0,
  probation: 1,
  stable: 2,
  canonical: 3,
  enforced: 4,
  dormant: -1,
};
function tierRankGt(a: string, b: string): boolean {
  return (TIER_RANK[a] ?? -1) > (TIER_RANK[b] ?? -1);
}
