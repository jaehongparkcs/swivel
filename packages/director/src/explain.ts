import { MLB, runnersLabel, sportOf } from './sports';
import type { GameInfo, GameInsight } from './types';

export { periodLabel, clockLabel } from './labels';
export { BREAK_NAMES, breakName } from './sports';

export function matchup(info: GameInfo): string {
  return `${info.away.code} @ ${info.home.code}`;
}


export function durationLabel(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Period and clock for the scorebug: ["4th", "2:41"], or ["Bot 8th", "2 outs"] in baseball. */
export function gameClock(g: GameInsight): [string, string] {
  const sport = sportOf(g.info);
  return [sport.periodLabel(g.screen.period, g.screen), sport.clockLabel(g.screen, g.displayClock)];
}

/** "4th 2:41 · 2-pt game" style situation line ("Bot 8th, 2 outs, runner on 2nd · 1-run game" in baseball). */
export function situation(g: GameInsight): string {
  const s = g.screen;
  if (s.phase === 'final') return 'Final';
  if (s.phase === 'pregame') return 'Pregame';
  const sport = sportOf(g.info);
  const margin = Math.abs(s.homeScore - s.awayScore);
  const state = margin === 0 ? 'tied' : `${margin}-${sport.unit.short} game`;
  const [period, clock] = gameClock(g);
  if (sport === MLB) {
    const runners = s.phase === 'live' ? runnersLabel(s.bases) : undefined;
    return `${[period, clock, runners].filter(Boolean).join(', ')} · ${state}`;
  }
  return `${period} ${clock} · ${state}`;
}

export function scoreLine(g: GameInsight): string {
  const { home, away } = g.info;
  return `${away.code} ${g.screen.awayScore}–${g.screen.homeScore} ${home.code}`;
}

export function whyWatch(g: GameInsight): string {
  const bits: string[] = [];
  const sport = sportOf(g.info);
  if (g.tags.includes('overtime')) bits.push(sport === MLB ? 'extra innings' : 'overtime');
  else if (g.tags.includes('crunch')) bits.push(sport.crunchWord);
  else if (g.tags.includes('close')) bits.push('close game');
  if (g.tags.includes('run')) bits.push('on a run');
  if (g.tags.includes('favorite')) bits.push('your team');
  return bits.join(', ');
}
