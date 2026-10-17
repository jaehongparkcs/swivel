import { makeRng, between } from '../rng';
import type { ChannelRef, FeedEvent, GameInfo } from '../types';
import { TEAMS } from './teams';
import { simulateGame } from './simulateGame';

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

export function buildSlate(seed: number, nGames = 8): Slate {
  const rng = makeRng(seed);
  const pool = [...TEAMS].sort(() => rng() - 0.5);
  const games: GameInfo[] = [];
  for (let i = 0; i < nGames; i++) {
    const home = pool[2 * i];
    const away = pool[2 * i + 1];
    const channel: ChannelRef = {
      id: `ch-${700 + i}`,
      number: 700 + i * 2 + 1,
      name: CHANNEL_NAMES[i % CHANNEL_NAMES.length],
      delayMs: Math.round(between(rng, 25, 55) * 1000),
    };
    games.push({
      id: `g${i + 1}`,
      home,
      away,
      channel,
      scheduledStart: (TIP_OFFSETS_MIN[i % TIP_OFFSETS_MIN.length] * 60 + Math.round(between(rng, 0, 180))) * 1000,
    });
  }
  const events = games
    .flatMap((g, i) => simulateGame(g, { seed: seed * 101 + i * 7919 }))
    .sort((a, b) => a.t - b.t || a.gameId.localeCompare(b.gameId) || a.seq - b.seq);
  return { seed, games, events, endsAt: events[events.length - 1].t };
}
