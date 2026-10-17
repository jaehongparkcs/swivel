import { Platform } from 'react-native';

export interface DemoConfig {
  /** Which simulated night to replay. */
  seed: number;
  /** Slate seconds per real second. */
  speed: number;
  /** Slate ms to start from; undefined = just before crunch time. */
  startAt?: number;
  /** Team codes to start with as favorites. */
  favorites: string[];
}

/**
 * Night 51 with Tampa as your team: a media-timeout hop and return, split and
 * three-up crunch time, commercials collapsing the grid, and Tampa going to OT.
 * Found with packages/director/scripts/findDemo.ts.
 */
export const DEFAULT_DEMO: DemoConfig = { seed: 51, speed: 6, startAt: 5_960_000, favorites: ['TPA'] };

/** On web, ?seed=74&speed=8&start=7800 (seconds) overrides the defaults. */
export function readDemoConfig(): DemoConfig {
  const cfg: DemoConfig = { ...DEFAULT_DEMO };
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const q = new URLSearchParams(window.location.search);
    if (q.get('seed')) cfg.seed = Number(q.get('seed'));
    if (q.get('speed')) cfg.speed = Number(q.get('speed'));
    if (q.get('seed') && !q.get('start')) cfg.startAt = undefined;
    if (q.get('start')) cfg.startAt = Number(q.get('start')) * 1000;
    if (q.get('fav')) cfg.favorites = q.get('fav')!.split(',');
  }
  return cfg;
}

export const SPEEDS = [1, 4, 8, 16, 30];
