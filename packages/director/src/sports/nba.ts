import { BREAK_DURATION_MS, breakHazard } from '../breakModel';
import { clockLabel, periodLabel } from '../labels';
import { homeWinProb, leverageIndex } from '../winprob';
import type { FeedEvent } from '../types';
import type { Sport } from './sport';

/** Basketball: four 12-minute quarters, media timeouts, possessions every ~15 s. */
export const NBA: Sport = {
  id: 'nba',
  tag: 'HOOPS',
  unit: { one: 'point', many: 'points', short: 'pt' },
  startClock: 720,
  homeWinProb: (s, clock) => homeWinProb(s.homeScore - s.awayScore, s.period, clock),
  leverage: (s, clock) => leverageIndex(s.homeScore - s.awayScore, s.period, clock),
  periodLabel,
  clockLabel: (_s, clock) => clockLabel(clock),
  late: (s) => s.period >= 4,
  blowoutStage: (s) => s.period >= 3,
  overtime: (s) => s.period >= 5,
  runPoints: 8,
  breakDurationMs: BREAK_DURATION_MS,
  breakNames: {},
  breakHazard,
  breakForPeriodEnd: (e: FeedEvent) => (e.period === 2 ? 'halftime' : e.period >= 4 ? 'overtime' : 'quarter'),
  mediaWindows: true,
  crunchWord: 'crunch time',
  recap: { minTotal: 5, comeback: 4, pullAway: 6, cut: 5, run: 8, runPhrase: (n) => `a ${n}–0 run` },
};
