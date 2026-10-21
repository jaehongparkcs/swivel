import type { BreakKind, FeedEventType, GameSnapshot } from './types';

/** Typical on-air length of each stoppage, ms of viewer time. */
export const BREAK_DURATION_MS: Record<BreakKind, number> = {
  timeout: 150_000,
  mandatory: 165_000,
  quarter: 135_000,
  halftime: 900_000,
  overtime: 130_000,
  review: 75_000,
  // Not basketball breaks; here so every sport's table has the same keys.
  twominute: 150_000,
  inning: 135_000,
  pitching: 140_000,
};

/** Breaks that put the broadcast in commercial (a replay review usually doesn't). */
export function isCommercial(kind: BreakKind | undefined): boolean {
  return kind !== undefined && kind !== 'review';
}

export const BREAK_EVENT_TYPES: FeedEventType[] = [
  'timeout',
  'mandatory_timeout',
  'review',
  'two_minute_warning',
  'pitching_change',
  'period_end',
  'game_end',
];

export function breakRemainingMs(
  s: GameSnapshot,
  t: number,
  durations: Record<BreakKind, number> = BREAK_DURATION_MS,
): number | undefined {
  if (s.phase !== 'break' || !s.breakKind || s.breakStartedAt === undefined) return undefined;
  const expected = durations[s.breakKind];
  return Math.max(5_000, expected - (t - s.breakStartedAt));
}

/** Points scored by `side` minus opponent over the most recent unanswered stretch. */
export function currentRun(s: GameSnapshot): { side?: 'home' | 'away'; points: number } {
  const r = s.recentScoring;
  if (!r.length) return { points: 0 };
  const side = r[r.length - 1][1];
  let pts = 0;
  for (let i = r.length - 1; i >= 0 && r[i][1] === side; i--) pts += r[i][2];
  return { side, points: pts };
}

/**
 * Probability the game goes to a stoppage within the next ~45s of live play,
 * from the rules of the game (media-timeout windows, period ends) and coaching
 * behavior (timeouts to stop opponent runs, late-game timeouts).
 */
export function breakHazard(s: GameSnapshot, displayClock: number, leverage: number): number {
  if (s.phase !== 'live') return 0;
  const ps: number[] = [0.07];
  if (s.mandatoryArmed) ps.push(0.55);
  if (displayClock < 45) ps.push(0.85);
  else if (displayClock < 90) ps.push(0.3);
  const run = currentRun(s);
  if (run.points >= 8) ps.push(0.35);
  else if (run.points >= 6) ps.push(0.15);
  if (s.period >= 4 && displayClock < 120 && leverage > 2) ps.push(0.3);
  return 1 - ps.reduce((acc, p) => acc * (1 - p), 1);
}
