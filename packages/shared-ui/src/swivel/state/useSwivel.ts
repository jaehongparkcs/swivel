import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Director, type DirectorView, type TasteSnapshot, type TeamPrefs } from '@swivel/director';
import { keyValueStore } from './platform';

const TASTE_KEY = 'swivel.taste.v1';

/** Learned taste survives reloads wherever the key-value store persists (web today; Vega's storage next). */
function loadTaste(): TasteSnapshot | undefined {
  try {
    const raw = keyValueStore.get(TASTE_KEY);
    return raw ? (JSON.parse(raw) as TasteSnapshot) : undefined;
  } catch {
    return undefined;
  }
}

function saveTaste(t: TasteSnapshot): void {
  keyValueStore.set(TASTE_KEY, JSON.stringify(t));
}
import type { Lineup } from './lineup';

const TICK_MS = 250;
/** Keep ticking a little past the last event so the final decisions land. */
const RUN_OUT_MS = 120_000;

/**
 * Runs the director against a lineup: polls the feed, ticks the director on a
 * replay (or live) clock, and exposes the remote's actions. On a device, a
 * PlaybackController would follow `view.slots` / `view.audio` to tune channels.
 */
export function useSwivel(lineup: Lineup, initialSpeed: number, initialPrefs: TeamPrefs) {
  const { source, startAt, endsAt } = lineup;
  const games = useMemo(() => source.games(), [source]);
  const director = useMemo(() => new Director(games, initialPrefs, {}, loadTaste()), [games]); // prefs only seed it

  const clock = useRef({ slateAt: startAt, realAt: Date.now(), speed: initialSpeed, polled: startAt });
  const [view, setView] = useState<DirectorView>(() => {
    director.ingestAll(source.poll(-1, startAt));
    return director.tick(startAt);
  });

  const now = useCallback(() => {
    const c = clock.current;
    return c.slateAt + (Date.now() - c.realAt) * c.speed;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Math.min(now(), endsAt + RUN_OUT_MS);
      director.ingestAll(source.poll(clock.current.polled, t));
      clock.current.polled = t;
      setView(director.tick(t));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [director, source, endsAt, now]);

  const setSpeed = useCallback(
    (speed: number) => {
      clock.current = { ...clock.current, slateAt: now(), realAt: Date.now(), speed };
    },
    [now],
  );

  /** Run a remote action, keep what it taught the learner, and redraw now rather than at the next tick. */
  const act = (fn: (t: number) => void, learns = true) => {
    fn(now());
    if (learns) saveTaste(director.tasteSnapshot());
    setView(director.tick(now()));
  };

  return {
    games,
    view,
    speed: clock.current.speed,
    setSpeed,
    prefs: director.getPrefs(),
    setPrefs: (p: TeamPrefs) => act(() => director.setPrefs(p), false),
    toggleLock: () => act((t) => director.toggleLock(t)),
    watch: (gameId: string) => act((t) => director.manualSelect(gameId, t)),
    skip: () => act((t) => director.skip(t)),
    resetLearning: () => act((t) => director.resetLearning(t)),
  };
}
