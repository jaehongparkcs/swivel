import { normCdf } from '../winprob';
import type { GameSnapshot } from '../types';
import { combineHazards, ordinal, type Sport } from './sport';

/**
 * Baseball: no clock. `period` counts half-innings (1 = top of the 1st, 2 = bottom
 * of the 1st, ...), and the state that matters is outs and runners.
 *
 * Win probability: each remaining half-inning adds runs with mean ~0.5 and variance
 * ~1 for the team batting in it; the half-inning in progress adds the run
 * expectancy of its base-out state (the standard RE24 table). The final margin is
 * then approximately Normal, as in the clock sports.
 */
const REGULATION_INNINGS = 9;
const RUNS_PER_HALF = 0.5;
const VAR_PER_HALF = 1.0;
const HOME_EDGE = 0.15;
const SWING = 0.5; // one run, either way
/** From the 8th on, scales leverage so a one-run 9th reads as crunch time, like a one-possession 4th quarter. */
const LATE_LEVERAGE_SCALE = 1.3;

/** Expected runs for the rest of the half-inning, by outs then runners (bitmask 1 = 1st, 2 = 2nd, 4 = 3rd). */
const RE24 = [
  [0.5, 0.86, 1.1, 1.44, 1.35, 1.75, 1.96, 2.29],
  [0.27, 0.51, 0.66, 0.88, 0.95, 1.1, 1.38, 1.54],
  [0.1, 0.22, 0.32, 0.43, 0.35, 0.48, 0.58, 0.75],
];

const inningOf = (half: number) => Math.ceil(half / 2);
const isTop = (half: number) => half % 2 === 1;

function params(s: GameSnapshot): { mu: number; sigma: number } {
  const half = Math.max(1, s.period);
  const lastHalf = 2 * Math.max(REGULATION_INNINGS, inningOf(half));
  let homeMean = 0;
  let awayMean = 0;
  let variance = 0;
  // Half-innings still to start.
  for (let h = half + 1; h <= lastHalf; h++) {
    if (isTop(h)) awayMean += RUNS_PER_HALF;
    else homeMean += RUNS_PER_HALF;
    variance += VAR_PER_HALF;
  }
  // The one in progress (none left once it's over: three outs, or between halves).
  const outs = s.outs ?? 0;
  const inProgress = s.phase !== 'pregame' && !(s.phase === 'break' && s.breakKind === 'inning') && outs < 3;
  const re = inProgress ? RE24[outs][s.bases ?? 0] : s.phase === 'pregame' ? RUNS_PER_HALF : 0;
  if (re > 0) {
    if (isTop(half)) awayMean += re;
    else homeMean += re;
    variance += VAR_PER_HALF * (re / RUNS_PER_HALF);
  }
  const remainingShare = variance / (2 * REGULATION_INNINGS * VAR_PER_HALF);
  return {
    mu: s.homeScore - s.awayScore + homeMean - awayMean + HOME_EDGE * remainingShare,
    sigma: Math.sqrt(Math.max(variance, 0.09)),
  };
}

function rawLeverage(s: GameSnapshot): number {
  const { mu, sigma } = params(s);
  return normCdf((mu + SWING) / sigma) - normCdf((mu - SWING) / sigma);
}

const FIRST_PITCH = { homeScore: 0, awayScore: 0, period: 1, phase: 'live', outs: 0, bases: 0 } as GameSnapshot;
const BASELINE = rawLeverage(FIRST_PITCH);

const RUNNER_NAMES: Record<number, string> = {
  1: 'runner on 1st',
  2: 'runner on 2nd',
  3: 'runners on 1st & 2nd',
  4: 'runner on 3rd',
  5: 'runners on 1st & 3rd',
  6: 'runners on 2nd & 3rd',
  7: 'bases loaded',
};

export function runnersLabel(bases: number | undefined): string | undefined {
  return bases ? RUNNER_NAMES[bases] : undefined;
}

export const MLB: Sport = {
  id: 'mlb',
  name: 'Baseball',
  tag: 'BASEBALL',
  startWords: { soon: 'First pitch in', now: 'First pitch' },
  overtimeWord: 'extra innings',
  unit: { one: 'run', many: 'runs', short: 'run' },
  startClock: 0,
  homeWinProb(s) {
    if (s.phase === 'final') return s.homeScore > s.awayScore ? 1 : 0;
    const { mu, sigma } = params(s);
    return normCdf(mu / sigma);
  },
  leverage(s) {
    if (s.phase === 'final') return 0;
    const scale = inningOf(s.period) >= 8 ? LATE_LEVERAGE_SCALE : 1;
    return (scale * rawLeverage(s)) / BASELINE;
  },
  periodLabel: (half, s) =>
    s?.phase === 'break' && s.breakKind === 'inning'
      ? `${isTop(half) ? 'Mid' : 'End'} ${ordinal(inningOf(half))}`
      : `${isTop(half) ? 'Top' : 'Bot'} ${ordinal(inningOf(half))}`,
  clockLabel: (s) => {
    if (s.phase === 'break' && s.breakKind === 'inning') return '';
    const outs = Math.min(3, s.outs ?? 0);
    return `${outs} out${outs === 1 ? '' : 's'}`;
  },
  whenLabel(s, clock) {
    const runners = s.phase === 'live' ? runnersLabel(s.bases) : undefined;
    return [MLB.periodLabel(s.period, s), MLB.clockLabel(s, clock), runners].filter(Boolean).join(', ');
  },
  late: (s) => inningOf(s.period) >= 8,
  blowoutStage: (s) => inningOf(s.period) >= 6,
  overtime: (s) => inningOf(s.period) > REGULATION_INNINGS,
  runPoints: 3,
  breakDurationMs: {
    timeout: 90_000,
    mandatory: 130_000,
    quarter: 135_000,
    halftime: 135_000,
    overtime: 135_000,
    review: 75_000,
    twominute: 135_000,
    inning: 135_000,
    pitching: 140_000,
  },
  breakNames: { inning: 'Inning break', pitching: 'Pitching change', review: 'Replay review' },
  breakShortNames: { pitching: 'Pitching chg' },
  breakHazard(s) {
    if (s.phase !== 'live') return 0;
    const outs = s.outs ?? 0;
    const ps = [0.03];
    if (outs === 2)
      ps.push(0.35); // the third out ends the half-inning
    else if (outs === 1 && (s.bases ?? 0) & 1) ps.push(0.08); // double play
    if (inningOf(s.period) >= 6 && (s.bases ?? 0) > 0) ps.push(0.06); // pitching change
    return combineHazards(ps);
  },
  breakForPeriodEnd: () => 'inning',
  mediaWindows: false,
  crunchWord: 'late and close',
  recap: { minTotal: 2, comeback: 2, pullAway: 3, cut: 2, run: 3, runPhrase: (n) => `${n} unanswered runs` },
};
