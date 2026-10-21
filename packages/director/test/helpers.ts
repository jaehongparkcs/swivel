import type { FeedEvent, FeedEventType, GameInfo } from '../src/types';
import { TEAMS } from '../src/sim/teams';

export function game(id: string, i: number, delayMs = 0): GameInfo {
  return {
    id,
    home: TEAMS[2 * i],
    away: TEAMS[2 * i + 1],
    channel: { id: `ch-${id}`, number: 100 + i, name: `Ch ${i}`, delayMs },
    scheduledStart: 0,
  };
}

/** Tiny scripted feed builder: ev(gameId)(t seconds, type, period, clock, home, away). */
export function feed(gameId: string) {
  let seq = 0;
  return (
    tSec: number,
    type: FeedEventType,
    period: number,
    clock: number,
    home: number,
    away: number,
    extra: Partial<FeedEvent> = {},
  ): FeedEvent => ({
    gameId,
    seq: seq++,
    t: tSec * 1000,
    type,
    period,
    clock,
    clockRunning: !['timeout', 'mandatory_timeout', 'period_end', 'game_end', 'foul', 'review'].includes(type),
    homeScore: home,
    awayScore: away,
    text: type,
    ...extra,
  });
}
