export interface FreqState {
  lastInjectedAt: Date | null;
  recentSessionCount: number;
}

export interface FreqConfig {
  cooldownMinutes: number;
  sessionWindowMinutes: number;
  sessionMaxInjections: number;
  now: Date;
}

export function shouldInject(state: FreqState, config: FreqConfig): boolean {
  if (state.recentSessionCount >= config.sessionMaxInjections) return false;
  if (state.lastInjectedAt === null) return true;
  const minutesSince =
    (config.now.getTime() - state.lastInjectedAt.getTime()) / 60_000;
  return minutesSince >= config.cooldownMinutes;
}
