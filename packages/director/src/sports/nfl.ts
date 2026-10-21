import { normCdf } from '../winprob';
import type { FeedEvent, GameSnapshot } from '../types';
import { clockSecondsLeft, combineHazards, type Sport } from './sport';

/**
 * Football: four 15-minute quarters, 10-minute sudden-death overtime.
 *
 * Win probability is the same Brownian-margin model as basketball with football's
 * spread of outcomes, plus the expected points of the drive in progress (from
 * field position) for the team with the ball.
 */
const PERIOD = 900;
const REGULATION = 4 * PERIOD;
const SIGMA_GAME = 13.5;
const HOME_EDGE = 2;
/** Expected points of a drive from its field position (own 25 ~ 1, midfield ~ 2.6, opponent's 10 ~ 5). */
const expectedPoints = (fieldPos: number | undefined) => (fieldPos === undefined ? 2 : Math.max(0, -0.6 + 0.065 * fieldPos));
const SWING = 3; // a field goal
/** Scores come in 3s and 7s, so the last minutes keep more spread than a smooth model gives. */
const LUMP_SIGMA = 3.5;
const LUMP_WINDOW = 300;

const secondsLeft = (s: GameSnapshot, clock: number) => clockSecondsLeft(s.period, clock, PERIOD);

function params(s: GameSnapshot, secs: number) {
  const margin = s.homeScore - s.awayScore;
  const ball = s.possession === 'home' ? 1 : s.possession === 'away' ? -1 : 0;
  return {
    mu: margin + (HOME_EDGE * secs) / REGULATION + ball * expectedPoints(s.fieldPos),
    sigma: Math.sqrt((SIGMA_GAME ** 2 * Math.max(secs, 4)) / REGULATION + LUMP_SIGMA ** 2 * Math.min(1, secs / LUMP_WINDOW)),
  };
}

function rawLeverage(s: GameSnapshot, secs: number): number {
  const { mu, sigma } = params(s, secs);
  return normCdf((mu + SWING) / sigma) - normCdf((mu - SWING) / sigma);
}

const EVEN_START = { homeScore: 0, awayScore: 0, period: 1 } as GameSnapshot;
const BASELINE = rawLeverage(EVEN_START, REGULATION);

export const NFL: Sport = {
  id: 'nfl',
  tag: 'FOOTBALL',
  unit: { one: 'point', many: 'points', short: 'pt' },
  startClock: PERIOD,
  homeWinProb(s, clock) {
    const secs = secondsLeft(s, clock);
    const margin = s.homeScore - s.awayScore;
    if (secs <= 0) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
    const { mu, sigma } = params(s, secs);
    return normCdf(mu / sigma);
  },
  leverage(s, clock) {
    const secs = secondsLeft(s, clock);
    if (secs <= 0) return s.homeScore === s.awayScore ? 4 : 0;
    return rawLeverage(s, secs) / BASELINE;
  },
  periodLabel: (p) => (p <= 4 ? ['1st', '2nd', '3rd', '4th'][p - 1] : p === 5 ? 'OT' : `${p - 4}OT`),
  clockLabel(_s, clock) {
    const c = Math.max(0, Math.ceil(clock));
    return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`;
  },
  late: (s) => s.period >= 4,
  blowoutStage: (s) => s.period >= 3,
  overtime: (s) => s.period >= 5,
  runPoints: 14,
  breakDurationMs: {
    timeout: 75_000,
    mandatory: 135_000,
    quarter: 135_000,
    halftime: 780_000,
    overtime: 180_000,
    review: 100_000,
    twominute: 150_000,
    inning: 135_000,
    pitching: 135_000,
  },
  breakNames: { mandatory: 'TV timeout', review: 'Replay review', twominute: 'Two-minute warning' },
  breakHazard(s, clock, leverage) {
    if (s.phase !== 'live') return 0;
    const ps = [0.08];
    if ((s.fieldPos ?? 0) >= 80) ps.push(0.3); // red zone: a score, then a TV timeout
    if (s.lastEvent?.type === 'kickoff') ps.push(0.35); // TV timeout right after the kickoff
    if (clock < 40) ps.push(0.8); // end of the quarter
    if ((s.period === 2 || s.period === 4) && clock > 120 && clock < 165) ps.push(0.7); // two-minute warning
    if (s.period >= 4 && clock < 240 && leverage > 2) ps.push(0.3); // late timeouts
    return combineHazards(ps);
  },
  breakForPeriodEnd: (e: FeedEvent) => (e.period === 2 ? 'halftime' : e.period >= 4 ? 'overtime' : 'quarter'),
  mediaWindows: false,
  crunchWord: 'crunch time',
  recap: { minTotal: 3, comeback: 4, pullAway: 10, cut: 7, run: 14, runPhrase: (n) => `${n} unanswered points` },
};
