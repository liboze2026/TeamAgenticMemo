import { computeConfidence } from "./wilson.js";
import { computeDemerit, type DemeritEvent } from "./demerit.js";
import { effectiveTier } from "./tier.js";
import { applyHysteresis } from "./hysteresis.js";
import type {
  CalibratorV2,
  CalibratorV2Input,
  CalibrationResultV2,
  Observation,
  Tier,
  TierTransition,
  DeltaStep,
} from "@teamagent/ports";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

const DEMERIT_KIND_TO_SOURCE: Record<string, DemeritEvent["source"]> = {
  "ai.override.ignored": "ai_override_ignored",
  "calibrator.user_reject": "user_reject",
  "validator.failure": "validator_fail",
};

function eventsToDemeritEvents(events: PersistedEvent[], knowledgeId: string): DemeritEvent[] {
  const out: DemeritEvent[] = [];
  for (const e of events) {
    if (e.knowledge_id !== knowledgeId) continue;
    const source = DEMERIT_KIND_TO_SOURCE[e.kind];
    if (!source) continue;
    out.push({ source, timestamp: e.timestamp });
  }
  return out;
}

function statusFromTier(
  oldStatus: KnowledgeEntry["status"],
  tier: Tier,
): KnowledgeEntry["status"] {
  if (tier === "dormant") return "dormant";
  if (oldStatus === "conflict" || oldStatus === "stale") return oldStatus;
  return "active";
}

export const v2Calibrator: CalibratorV2 = {
  calibrate(entry: KnowledgeEntry, input: CalibratorV2Input): CalibrationResultV2 {
    const ownObs: Observation[] = input.observations.filter(
      (o) => o.knowledge_id === entry.id,
    );

    // 1. Confidence (Wilson LB with time decay)
    // CRITICAL: when ownObs.length === 0, do NOT call computeConfidence (returns 0 on empty array)
    const newConfidence = ownObs.length > 0
      ? computeConfidence(ownObs, entry.max_tier_ever as Tier, input.now)
      : entry.confidence;

    // 2. Demerit
    const demeritEvents = eventsToDemeritEvents(input.events, entry.id);
    const demeritRes = computeDemerit(
      {
        current: entry.demerit,
        last_updated: entry.demerit_last_updated,
        current_tier: entry.current_tier as Tier,
        confidence: newConfidence,
      },
      demeritEvents,
      input.now,
    );

    // 3. Candidate tier (pessimist of confidence + death chain)
    const candidate = effectiveTier(newConfidence, demeritRes.demerit, entry.current_tier as Tier);

    // 4. Hysteresis (promotion/demotion guards)
    const enteredAt = entry.tier_entered_at || entry.created_at;
    const obsInCurrentTier = ownObs.filter(
      (o) => new Date(o.timestamp) >= new Date(enteredAt),
    ).length;
    const hys = applyHysteresis({
      current_tier: entry.current_tier as Tier,
      candidate_tier: candidate,
      confidence: newConfidence,
      demerit: demeritRes.demerit,
      tier_entered_at: enteredAt,
      observation_count_in_current_tier: obsInCurrentTier,
      now: input.now,
    });

    // 5. Delta breakdown
    const breakdown: DeltaStep[] = [];
    if (ownObs.length > 0) {
      breakdown.push({
        type: "obs_added",
        weight: ownObs.length,
        conf_delta: newConfidence - entry.confidence,
        note: `${ownObs.length} observations → Wilson LB`,
      });
    }
    breakdown.push(...demeritRes.breakdown);

    const tierTransition: TierTransition | null =
      hys.final_tier !== entry.current_tier
        ? {
            from: entry.current_tier as Tier,
            to: hys.final_tier,
            reason:
              demeritRes.demerit >= 30
                ? "death_chain_dormant"
                : "hysteresis_passed",
          }
        : null;

    if (tierTransition) {
      breakdown.push({
        type: "tier_transition",
        note: `${tierTransition.from} → ${tierTransition.to} (${tierTransition.reason})`,
      });
    }

    return {
      confidence: newConfidence,
      demerit: demeritRes.demerit,
      tier_before: entry.current_tier as Tier,
      tier_after: hys.final_tier,
      status: statusFromTier(entry.status, hys.final_tier),
      confidence_delta: newConfidence - entry.confidence,
      demerit_delta: demeritRes.demerit - entry.demerit,
      delta_breakdown: breakdown,
      tier_transition: tierTransition,
      reason_for_no_transition: hys.blocked_reason,
    };
  },
};
