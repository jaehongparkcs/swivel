import { buildSlate, ReplayLineupSource, suggestDemoStart, type LineupSource } from '@swivel/director';
import type { DemoConfig } from './demoConfig';

/**
 * Tonight's lineup: where games and feed events come from, and the slate-clock
 * range to play. The demo replays a simulated night; a device build swaps in a
 * LineupSource built from the Vega EPG Provider and a licensed data feed, with
 * startAt = now and endsAt = Infinity.
 */
export interface Lineup {
  source: LineupSource;
  startAt: number;
  endsAt: number;
}

/** The demo lineup: a simulated night, starting at the configured moment (or just before crunch time). */
export function demoLineup(config: DemoConfig): Lineup {
  const slate = buildSlate(config.seed, 8, { resumeLagMs: config.resumeLagMs, sports: config.sports });
  return {
    source: new ReplayLineupSource(slate),
    startAt: config.startAt ?? suggestDemoStart(slate),
    endsAt: slate.endsAt,
  };
}
