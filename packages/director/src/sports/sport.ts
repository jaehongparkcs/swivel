import type { BreakKind, FeedEvent, GameSnapshot, SportId } from '../types';

/** How a sport's numbers read in recaps ("erased a 7-point deficit", "3 unanswered runs"). */
export interface RecapScale {
  /** Ignore stretches with fewer combined points than this. */
  minTotal: number;
  /** A deficit this big turned into a lead reads as a comeback. */
  comeback: number;
  /** The leader grew the margin by this much: "pulled away". */
  pullAway: number;
  /** The trailer closed the gap by this much: "cut a lead". */
  cut: number;
  /** An unanswered run this big is the story. */
  run: number;
  /** "a 9–0 run" (basketball) or "17 unanswered points". */
  runPhrase(n: number): string;
}

/**
 * Everything the engine needs to know about a sport. Breaks, hops, multiview and
 * learning are shared; the rules of the game live here.
 */
export interface Sport {
  id: SportId;
  /** Short label for the rail and scorebug. Generic, not a league name. */
  tag: string;
  unit: { one: string; many: string; short: string };
  /** Game clock before the start (seconds), for the pregame scorebug. */
  startClock: number;
  homeWinProb(s: GameSnapshot, clock: number): number;
  /** How much the next play swings the outcome; 1.0 ~ the opening play of an even game. */
  leverage(s: GameSnapshot, clock: number): number;
  /** Pass the snapshot for labels that depend on state (baseball's "Mid 4th" during an inning break). */
  periodLabel(period: number, s?: GameSnapshot): string;
  /** "2:41", or "2 outs" in baseball. */
  clockLabel(s: GameSnapshot, clock: number): string;
  /** Late enough that a high-leverage moment counts as crunch time. */
  late(s: GameSnapshot): boolean;
  /** Far enough along that a lopsided score is a blowout. */
  blowoutStage(s: GameSnapshot): boolean;
  overtime(s: GameSnapshot): boolean;
  /** Unanswered points that make a "run". */
  runPoints: number;
  /** Typical on-air length of each stoppage, ms. */
  breakDurationMs: Record<BreakKind, number>;
  breakNames: Partial<Record<BreakKind, string>>;
  /** Probability of a stoppage in the next ~45 s of live play. */
  breakHazard(s: GameSnapshot, clock: number, leverage: number): number;
  breakForPeriodEnd(e: FeedEvent): BreakKind;
  /** Basketball's media-timeout windows (first dead ball under 7:00 and 3:00). */
  mediaWindows: boolean;
  /** Words for "high leverage, late": "crunch time", "late and close". */
  crunchWord: string;
  recap: RecapScale;
}

/** Shared helper for a game-clock sport: 4 periods of `periodSec`, overtime of `otSec`. */
export function clockSecondsLeft(period: number, clock: number, periodSec: number): number {
  if (period <= 4) return (4 - period) * periodSec + Math.max(0, clock);
  return Math.max(0, clock);
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

export function combineHazards(ps: number[]): number {
  return 1 - ps.reduce((acc, p) => acc * (1 - p), 1);
}
