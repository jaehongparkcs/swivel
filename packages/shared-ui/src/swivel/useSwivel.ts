import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Director,
  ReplayLineupSource,
  buildSlate,
  suggestDemoStart,
  type DirectorView,
  type TeamPrefs,
  type TasteSnapshot,
} from '@swivel/director';
import { Platform } from 'react-native';

const TASTE_KEY = 'swivel.taste.v1';

/**
 * Learned taste survives reloads on web (localStorage). On Vega this is
 * in-memory for now; the device version would use Vega's key-value storage.
 */
function loadTaste(): TasteSnapshot | undefined {
  if (Platform.OS !== 'web') return undefined;
  try {
    const raw = window.localStorage.getItem(TASTE_KEY);
    return raw ? (JSON.parse(raw) as TasteSnapshot) : undefined;
  } catch {
    return undefined;
  }
}

function saveTaste(t: TasteSnapshot): void {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(TASTE_KEY, JSON.stringify(t));
  } catch {
    /* storage unavailable: learning still works for this session */
  }
}
import type { DemoConfig } from './demoConfig';

const TICK_MS = 250;

/**
 * Hosts the director against a replayed slate. On a device this is where a
 * Vega EPG-backed LineupSource and a PlaybackController would be wired in.
 */
export function useSwivel(config: DemoConfig, initialPrefs: TeamPrefs) {
  const lag = config.resumeLagMs;
  const sports = config.sports?.join(',');
  const slate = useMemo(
    () => buildSlate(config.seed, 8, { resumeLagMs: lag, sports: config.sports }),
    [config.seed, lag?.[0], lag?.[1], sports],
  );
  const source = useMemo(() => new ReplayLineupSource(slate), [slate]);
  const director = useMemo(() => new Director(source.games(), initialPrefs, {}, loadTaste()), [source]);

  const startAt = config.startAt ?? suggestDemoStart(slate);
  const clock = useRef({ slateAt: startAt, realAt: Date.now(), speed: config.speed, polled: 0 });
  const [view, setView] = useState<DirectorView>(() => {
    director.ingestAll(source.poll(-1, startAt));
    clock.current.polled = startAt;
    return director.tick(startAt);
  });

  const now = useCallback(() => {
    const c = clock.current;
    return c.slateAt + (Date.now() - c.realAt) * c.speed;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Math.min(now(), slate.endsAt + 120_000);
      director.ingestAll(source.poll(clock.current.polled, t));
      clock.current.polled = t;
      setView(director.tick(t));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [director, source, slate, now]);

  const setSpeed = useCallback(
    (speed: number) => {
      clock.current = { ...clock.current, slateAt: now(), realAt: Date.now(), speed };
    },
    [now],
  );

  const refresh = () => setView(director.tick(now()));

  return {
    slate,
    view,
    speed: clock.current.speed,
    setSpeed,
    prefs: director.getPrefs(),
    setPrefs: (p: TeamPrefs) => {
      director.setPrefs(p);
      refresh();
    },
    toggleLock: () => {
      director.toggleLock(now());
      saveTaste(director.tasteSnapshot());
      refresh();
    },
    watch: (gameId: string) => {
      director.manualSelect(gameId, now());
      saveTaste(director.tasteSnapshot());
      refresh();
    },
    skip: () => {
      director.skip(now());
      saveTaste(director.tasteSnapshot());
      refresh();
    },
    resetLearning: () => {
      director.resetLearning(now());
      saveTaste(director.tasteSnapshot());
      refresh();
    },
  };
}
