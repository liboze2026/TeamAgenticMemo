import type { Tier, DeltaStep } from "@teamagent/ports";

const DAY_MS = 24 * 3600 * 1000;

export const DEMERIT_HALF_LIFE_DAYS: Record<Exclude<Tier, "dormant">, number> = {
  experimental: 7,
  probation: 10,
  stable: 14,
  canonical: 21,
  enforced: 28,
};

export const DEMERIT_BASE_BY_TIER: Record<Exclude<Tier, "dormant">, number> = {
  experimental: 1,
  probation: 2,
  stable: 3,
  canonical: 5,
  enforced: 10,
};

export interface DemeritEvent {
  source: "ai_override_ignored" | "user_reject" | "validator_fail" | string;
  timestamp: string;
}

export interface DemeritInput {
  current: number;
  last_updated: string;   // ISO8601 or "" for never
  current_tier: Tier;
  confidence: number;
}

export interface DemeritResult {
  demerit: number;
  breakdown: DeltaStep[];
}

/**
 * Decay existing demerit then add new event penalties. Pure function. Per design §4.3.
 */
export function computeDemerit(
  input: DemeritInput,
  events: DemeritEvent[],
  now: Date,
): DemeritResult {
  const breakdown: DeltaStep[] = [];
  const tier: Exclude<Tier, "dormant"> =
    input.current_tier === "dormant" ? "experimental" : (input.current_tier as Exclude<Tier, "dormant">);

  // 1. Decay existing demerit
  let d = input.current;
  if (d > 0 && input.last_updated) {
    const daysSince = (now.getTime() - new Date(input.last_updated).getTime()) / DAY_MS;
    if (daysSince > 0) {
      const lambda = Math.LN2 / DEMERIT_HALF_LIFE_DAYS[tier];
      const decayed = d * Math.exp(-lambda * daysSince);
      breakdown.push({
        type: "demerit_decay",
        days_since: daysSince,
        demerit_delta: decayed - d,
        note: `half-life=${DEMERIT_HALF_LIFE_DAYS[tier]}d at tier=${tier}`,
      });
      d = decayed;
    }
  }

  // 2. Add new event penalties
  for (const e of events) {
    const base = DEMERIT_BASE_BY_TIER[tier];
    const multiplier = input.confidence > 0.5 ? -Math.log(1 - input.confidence) : 1.0;
    const userOverride = e.source === "user_reject" ? 10 : 0;
    const delta = base * multiplier + userOverride;
    breakdown.push({
      type: "demerit_added",
      demerit_delta: delta,
      note: `source=${e.source}, base=${base}, mult=${multiplier.toFixed(2)}, override=+${userOverride}`,
    });
    d += delta;
  }

  return { demerit: Math.max(0, d), breakdown };
}
