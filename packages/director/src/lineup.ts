import type { FeedEvent, GameInfo, Layout } from './types';
import type { Slate } from './sim/slate';

/**
 * Where games come from. A LineupSource pairs the viewer's live TV lineup
 * (channels from the EPG carrying tonight's games) with a play-by-play feed.
 *
 * - ReplayLineupSource: a recorded or simulated slate (demo, tests).
 * - On a device: build one from the Vega EPG Provider (which channels carry which
 *   games) plus a licensed sports data feed (scores, timeouts, clock).
 */
export interface LineupSource {
  games(): GameInfo[];
  /** Feed events published in the half-open window (from, to]. */
  poll(from: number, to: number): FeedEvent[];
}

/**
 * What the director drives. On a device this maps to Vega channel tuning for
 * the primary slot and additional players for multiview tiles.
 */
export interface PlaybackController {
  show(layout: Layout, channelIds: string[], audioChannelId: string): void;
}

export class ReplayLineupSource implements LineupSource {
  constructor(private readonly slate: Slate) {}

  games(): GameInfo[] {
    return this.slate.games;
  }

  private lowerBound(t: number): number {
    const ev = this.slate.events;
    let lo = 0;
    let hi = ev.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ev[mid].t <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo; // first index with e.t > t
  }

  poll(from: number, to: number): FeedEvent[] {
    if (to <= from) return [];
    return this.slate.events.slice(this.lowerBound(from), this.lowerBound(to));
  }
}
