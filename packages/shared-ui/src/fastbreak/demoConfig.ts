import { Platform } from 'react-native';

export interface DemoConfig {
  /** Which simulated night to replay. */
  seed: number;
  /** Slate seconds per real second. */
  speed: number;
  /** Slate ms to start from; undefined = just before crunch time. */
  startAt?: number;
}

export const DEFAULT_DEMO: DemoConfig = { seed: 74, speed: 8 };

/** On web, ?seed=74&speed=8&start=7800 (seconds) overrides the defaults. */
export function readDemoConfig(): DemoConfig {
  const cfg = { ...DEFAULT_DEMO };
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const q = new URLSearchParams(window.location.search);
    if (q.get('seed')) cfg.seed = Number(q.get('seed'));
    if (q.get('speed')) cfg.speed = Number(q.get('speed'));
    if (q.get('start')) cfg.startAt = Number(q.get('start')) * 1000;
  }
  return cfg;
}

export const SPEEDS = [1, 4, 8, 16, 30];
