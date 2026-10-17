import type { BreakKind, GameInfo, GameInsight } from './types';

export function matchup(info: GameInfo): string {
  return `${info.away.code} @ ${info.home.code}`;
}

export function periodLabel(period: number): string {
  if (period <= 4) return ['1st', '2nd', '3rd', '4th'][period - 1];
  return period === 5 ? 'OT' : `${period - 4}OT`;
}

export function clockLabel(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(1)}`;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function durationLabel(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export const BREAK_NAMES: Record<BreakKind, string> = {
  timeout: 'Timeout',
  mandatory: 'Media timeout',
  quarter: 'End of quarter',
  halftime: 'Halftime',
  overtime: 'Headed to overtime',
  review: 'Replay review',
};

/** "4th 2:41 · 2-pt game" style situation line. */
export function situation(g: GameInsight): string {
  const s = g.screen;
  if (s.phase === 'final') return 'Final';
  if (s.phase === 'pregame') return 'Pregame';
  const margin = Math.abs(s.homeScore - s.awayScore);
  const state = margin === 0 ? 'tied' : `${margin}-pt game`;
  return `${periodLabel(s.period)} ${clockLabel(g.displayClock)} · ${state}`;
}

export function scoreLine(g: GameInsight): string {
  const { home, away } = g.info;
  return `${away.code} ${g.screen.awayScore}–${g.screen.homeScore} ${home.code}`;
}

export function whyWatch(g: GameInsight): string {
  const bits: string[] = [];
  if (g.tags.includes('overtime')) bits.push('overtime');
  else if (g.tags.includes('crunch')) bits.push('crunch time');
  else if (g.tags.includes('close')) bits.push('close game');
  if (g.tags.includes('run')) bits.push('on a run');
  if (g.tags.includes('favorite')) bits.push('your team');
  return bits.join(', ');
}
