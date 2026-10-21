import { makeRng, between } from '../rng';
import { Director } from '../director';
import type { ChannelRef, FeedEvent, GameInfo, SportId } from '../types';
import { TEAMS, TEAMS_BY_SPORT } from './teams';
import { simulate, type SimOptions } from './simulateGame';

export interface Slate {
  seed: number;
  games: GameInfo[];
  events: FeedEvent[]; // all games, sorted by t
  /** Slate time at which the last game ends. */
  endsAt: number;
}

const CHANNEL_NAMES = ['Courtside 1', 'Courtside 2', 'Regional Sports East', 'Regional Sports West', 'Hoops Network', 'Sports Plus', 'Metro Sports', 'Courtside 3'];

/** Tip-off offsets (minutes) for an 8-game night: early wave, late wave. */
const TIP_OFFSETS_MIN = [0, 0, 5, 30, 30, 35, 60, 90];

export interface SlateOptions {
  /** See SimOptions.resumeLagMs. */
  resumeLagMs?: SimOptions['resumeLagMs'];
  /**
   * Sports on tonight's lineup, assigned to games in turn (['nba', 'nfl'] alternates).
   * Unset means an all-basketball night, exactly as before.
   */
  sports?: SportId[];
}

const SPORT_CHANNELS: Record<SportId, string[]> = {
  nba: CHANNEL_NAMES,
  nfl: ['Gridiron 1', 'Gridiron 2', 'Sunday Sports', 'Regional Sports North', 'Metro Sports'],
  mlb: ['Diamond 1', 'Diamond 2', 'Regional Sports South', 'Ballpark TV', 'Sports Plus'],
};

export function buildSlate(seed: number, nGames = 8, opts: SlateOptions = {}): Slate {
  const rng = makeRng(seed);
  const mixed = !!opts.sports && opts.sports.some((s) => s !== 'nba');
  const sportFor = (i: number): SportId => (mixed ? opts.sports![i % opts.sports!.length] : 'nba');
  // Basketball-only nights draw teams exactly as they always have, so saved demo nights don't change.
  const shuffle = (teams: typeof TEAMS) => [...teams].sort(() => rng() - 0.5);
  const pools: Record<SportId, typeof TEAMS> = mixed
    ? { nba: shuffle(TEAMS_BY_SPORT.nba), nfl: shuffle(TEAMS_BY_SPORT.nfl), mlb: shuffle(TEAMS_BY_SPORT.mlb) }
    : { nba: shuffle(TEAMS), nfl: [], mlb: [] };
  const used: Record<SportId, number> = { nba: 0, nfl: 0, mlb: 0 };
  const games: GameInfo[] = [];
  for (let i = 0; i < nGames; i++) {
    const sport = sportFor(i);
    const pool = pools[sport];
    const home = pool[used[sport]++ % pool.length];
    const away = pool[used[sport]++ % pool.length];
    const names = SPORT_CHANNELS[sport];
    const channel: ChannelRef = {
      id: `ch-${700 + i}`,
      number: 700 + i * 2 + 1,
      name: names[i % names.length],
      delayMs: Math.round(between(rng, 25, 55) * 1000),
    };
    games.push({
      id: `g${i + 1}`,
      home,
      away,
      channel,
      scheduledStart: (TIP_OFFSETS_MIN[i % TIP_OFFSETS_MIN.length] * 60 + Math.round(between(rng, 0, 180))) * 1000,
      ...(mixed ? { sport } : {}),
    });
  }
  const events = games
    .flatMap((g, i) => simulate(g, { seed: seed * 101 + i * 7919, resumeLagMs: opts.resumeLagMs }))
    .sort((a, b) => a.t - b.t || a.gameId.localeCompare(b.gameId) || a.seq - b.seq);
  return { seed, games, events, endsAt: events[events.length - 1].t };
}

/**
 * A good moment to start a demo: a few minutes before the director first goes to
 * split screen (two games in crunch time), falling back to the second 4th quarter.
 */
export function suggestDemoStart(slate: Slate, leadMs = 240_000): number {
  const d = new Director(slate.games);
  let i = 0;
  for (let t = 0; t <= slate.endsAt; t += 2000) {
    while (i < slate.events.length && slate.events[i].t <= t) d.ingest(slate.events[i++]);
    const v = d.tick(t);
    if (v.layout !== 'single') return Math.max(0, t - leadMs);
  }
  const q4 = slate.games
    .map((g) => slate.events.find((e) => e.gameId === g.id && e.type === 'period_start' && e.period === 4)?.t)
    .filter((t): t is number => t !== undefined)
    .sort((a, b) => a - b);
  return Math.max(0, (q4[1] ?? q4[0] ?? 0) - leadMs);
}
