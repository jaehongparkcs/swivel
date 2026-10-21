import type { BreakKind, GameInfo, SportId } from '../types';
import { MLB } from './mlb';
import { NBA } from './nba';
import { NFL } from './nfl';
import type { Sport } from './sport';

export const SPORTS: Record<SportId, Sport> = { nba: NBA, nfl: NFL, mlb: MLB };

/** Every sport, in display order. */
export const SPORT_IDS = Object.keys(SPORTS) as SportId[];

export function sportOf(info: Pick<GameInfo, 'sport'>): Sport {
  return SPORTS[info.sport ?? 'nba'];
}

const BREAK_NAMES: Record<BreakKind, string> = {
  timeout: 'Timeout',
  mandatory: 'Media timeout',
  quarter: 'End of quarter',
  halftime: 'Halftime',
  overtime: 'Headed to overtime',
  review: 'Replay review',
  twominute: 'Two-minute warning',
  inning: 'Inning break',
  pitching: 'Pitching change',
};

/** "Media timeout" in basketball, "TV timeout" in football, and so on. */
export function breakName(info: Pick<GameInfo, 'sport'>, kind: BreakKind | undefined): string {
  const k = kind ?? 'timeout';
  return sportOf(info).breakNames[k] ?? BREAK_NAMES[k];
}

export { BREAK_NAMES, MLB, NBA, NFL };
export { runnersLabel } from './mlb';
export type { RecapScale, Sport } from './sport';
