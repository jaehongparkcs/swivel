import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Director,
  ReplayLineupSource,
  buildSlate,
  suggestDemoStart,
  type DirectorView,
  type TeamPrefs,
} from '@fastbreak/director';
import type { DemoConfig } from './demoConfig';

const TICK_MS = 250;

/**
 * Hosts the director against a replayed slate. On a device this is where a
 * Vega EPG-backed LineupSource and a PlaybackController would be wired in.
 */
export function useFastbreak(config: DemoConfig, initialPrefs: TeamPrefs) {
  const slate = useMemo(() => buildSlate(config.seed), [config.seed]);
  const source = useMemo(() => new ReplayLineupSource(slate), [slate]);
  const director = useMemo(() => new Director(source.games(), initialPrefs), [source]);

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
      refresh();
    },
    watch: (gameId: string) => {
      director.manualSelect(gameId, now());
      refresh();
    },
  };
}
