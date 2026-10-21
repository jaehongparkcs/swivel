import { Platform } from 'react-native';
import type { SportId } from '@swivel/director';

export interface DemoConfig {
  /** Which simulated night to replay. */
  seed: number;
  /** Slate seconds per real second. */
  speed: number;
  /** Slate ms to start from; undefined = just before crunch time. */
  startAt?: number;
  /** Team codes to start with as favorites. */
  favorites: string[];
  /** Report "play resumes" this many ms late ([min, max]), like real feeds. Off when unset. */
  resumeLagMs?: [number, number];
  /** Sports on tonight's lineup, assigned to games in turn. Unset = basketball only. */
  sports?: SportId[];
  /** Show the splash and "Set up tonight" screens first (default). false = straight to watching. */
  intro?: boolean;
}

/**
 * Basketball only: night 51 with Tampa as your team (a media-timeout hop and return,
 * split and three-up crunch time, and Tampa going to OT).
 * Found with packages/director/scripts/findDemo.ts.
 */
export const BASKETBALL_DEMO: DemoConfig = { seed: 51, speed: 8, startAt: 5_960_000, favorites: ['TPA'] };

/**
 * Night 65, all three sports, with Dallas football as your team. In the first 35 s:
 * baseball, a hop to basketball on the inning break, "your team is back on", a
 * football + baseball split, then a three-up with all three sports. Then a
 * basketball game goes to overtime, Dallas closes out a 4-point 4th quarter, and
 * overtime sits beside a tied 9th inning.
 * Found with SPORTS=nba,nfl,mlb scripts/findMixedDemo.ts.
 */
export const MIXED_DEMO: DemoConfig = { seed: 65, speed: 8, startAt: 9_920_000, favorites: ['DAL'], sports: ['nba', 'nfl', 'mlb'] };

/** Which night the app opens on. BASKETBALL_DEMO is the basketball-only night. */
export const DEFAULT_DEMO: DemoConfig = MIXED_DEMO;

/** On web, ?seed=74&speed=8&start=7800 (seconds)&lag=5-15 (seconds)&sports=nba,nfl,mlb&intro=0 overrides the defaults (?basketball=1 opens the basketball-only night). */
export function readDemoConfig(): DemoConfig {
  let cfg: DemoConfig = { ...DEFAULT_DEMO };
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const q = new URLSearchParams(window.location.search);
    if (q.get('basketball')) cfg = { ...BASKETBALL_DEMO };
    if (q.get('sports')) cfg.sports = q.get('sports')!.split(',') as SportId[];
    if (q.get('intro') === '0') cfg.intro = false;
    if (q.get('seed')) cfg.seed = Number(q.get('seed'));
    if (q.get('speed')) cfg.speed = Number(q.get('speed'));
    if (q.get('seed') && !q.get('start')) cfg.startAt = undefined;
    if (q.get('start')) cfg.startAt = Number(q.get('start')) * 1000;
    if (q.get('fav')) cfg.favorites = q.get('fav')!.split(',');
    const lag = q.get('lag')?.split('-').map(Number);
    if (lag && lag.every((x: number) => Number.isFinite(x))) cfg.resumeLagMs = [lag[0] * 1000, (lag[1] ?? lag[0]) * 1000];
  }
  return cfg;
}

export const SPEEDS = [1, 4, 8, 16, 30];
